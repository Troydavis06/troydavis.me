(function () {
  var BG = 0x0f0f0f; // matches --bg in css/main.css

  // ---------------------------------------------------------------------
  // The hand is modeled as a signed distance field: capsules (bones) and
  // ellipsoids (muscle masses) blended with a smooth-min, like digital
  // clay. Marching tetrahedra turns it into one organic surface, which is
  // then rendered as a plexus: points scattered on the skin, wired to
  // whichever neighbors happen to be close as they drift.
  // ---------------------------------------------------------------------

  // Capsules: [ax, ay, az, bx, by, bz, radius, blend]
  // Pose: hook'em horns — index + pinky up, middle + ring folded into the
  // palm, thumb pressing across the folded fingers. +z faces the viewer.
  var CAPSULES = [
    // knuckle ridge across the top of the palm
    [-0.30, 0.40, 0.00, 0.28, 0.36, 0.00, 0.14, 0.10],
    // index finger — extended horn, near vertical
    [-0.30, 0.42, 0.01, -0.34, 0.78, 0.02, 0.095, 0.07],
    [-0.34, 0.78, 0.02, -0.37, 1.00, 0.03, 0.086, 0.05],
    [-0.37, 1.00, 0.03, -0.39, 1.14, 0.03, 0.078, 0.05],
    // middle finger — folded: proximal out to the PIP knuckle, middle
    // phalanx dropping down, distal tucked back into the palm
    [-0.11, 0.45, 0.02, -0.11, 0.40, 0.32, 0.094, 0.045],
    [-0.11, 0.40, 0.32, -0.11, 0.16, 0.36, 0.088, 0.035],
    [-0.11, 0.16, 0.36, -0.11, 0.05, 0.21, 0.080, 0.035],
    // ring finger — folded, staggered a touch lower and shallower,
    // drifting toward the middle finger like a relaxed fist
    [0.11, 0.43, 0.02, 0.10, 0.38, 0.29, 0.090, 0.04],
    [0.10, 0.38, 0.29, 0.09, 0.14, 0.33, 0.084, 0.03],
    [0.09, 0.14, 0.33, 0.09, 0.04, 0.19, 0.076, 0.03],
    // pinky — extended horn, shorter, leaning outward
    [0.28, 0.38, 0.01, 0.34, 0.62, 0.02, 0.080, 0.07],
    [0.34, 0.62, 0.02, 0.38, 0.80, 0.025, 0.073, 0.05],
    [0.38, 0.80, 0.025, 0.41, 0.92, 0.03, 0.068, 0.05],
    // thumb — sweeps up from the heel and presses across the folded fingers
    [-0.36, -0.30, 0.06, -0.30, -0.02, 0.24, 0.115, 0.09],
    [-0.30, -0.02, 0.24, -0.12, 0.14, 0.35, 0.102, 0.05],
    [-0.12, 0.14, 0.35, 0.07, 0.20, 0.33, 0.090, 0.04],
    // wrist / forearm
    [0.00, -0.56, -0.01, 0.02, -0.90, -0.03, 0.21, 0.12]
  ];

  // Ellipsoids: [cx, cy, cz, rx, ry, rz, blend]
  var ELLIPSOIDS = [
    [0.00, 0.00, 0.00, 0.46, 0.46, 0.185, 0.10],   // palm
    [0.00, 0.20, 0.00, 0.43, 0.30, 0.175, 0.11],   // upper palm, below knuckles
    [0.00, -0.17, 0.00, 0.43, 0.32, 0.175, 0.11],  // mid-palm waist filler
    [0.00, -0.33, 0.00, 0.40, 0.29, 0.175, 0.10],  // heel of the palm
    [-0.28, -0.26, 0.06, 0.20, 0.24, 0.160, 0.09], // thenar (thumb) mound
    [-0.11, 0.40, 0.33, 0.105, 0.10, 0.11, 0.035], // middle PIP knuckle bump
    [0.10, 0.38, 0.30, 0.100, 0.095, 0.105, 0.03]  // ring PIP knuckle bump
  ];

  function smin(a, b, k) {
    var h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }

  function handSDF(px, py, pz) {
    var d = 1e9, i, c, e;
    for (i = 0; i < CAPSULES.length; i++) {
      c = CAPSULES[i];
      var bax = c[3] - c[0], bay = c[4] - c[1], baz = c[5] - c[2];
      var pax = px - c[0], pay = py - c[1], paz = pz - c[2];
      var t = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      var dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
      d = smin(d, Math.sqrt(dx * dx + dy * dy + dz * dz) - c[6], c[7]);
    }
    for (i = 0; i < ELLIPSOIDS.length; i++) {
      e = ELLIPSOIDS[i];
      var qx = (px - e[0]) / e[3], qy = (py - e[1]) / e[4], qz = (pz - e[2]) / e[5];
      var k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
      var ux = qx / e[3], uy = qy / e[4], uz = qz / e[5];
      var k1 = Math.sqrt(ux * ux + uy * uy + uz * uz);
      d = smin(d, k1 > 0 ? k0 * (k0 - 1) / k1 : -e[3], e[6]);
    }
    return d;
  }

  // --- marching tetrahedra over a regular grid -------------------------
  var CORNERS = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
  ];
  var TETS = [
    [0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
    [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]
  ];

  function buildHandGeometry() {
    var h = 0.05;
    var x0 = -0.78, x1 = 0.78, y0 = -1.14, y1 = 1.30, z0 = -0.42, z1 = 0.56;
    var nx = Math.round((x1 - x0) / h) + 1;
    var ny = Math.round((y1 - y0) / h) + 1;
    var nz = Math.round((z1 - z0) / h) + 1;

    var field = new Float32Array(nx * ny * nz);
    var i, j, k;
    for (k = 0; k < nz; k++)
      for (j = 0; j < ny; j++)
        for (i = 0; i < nx; i++)
          field[i + j * nx + k * nx * ny] =
            handSDF(x0 + i * h, y0 + j * h, z0 + k * h);

    var verts = [];
    var indices = [];
    var edgeVerts = new Map();

    function cornerPos(g, out) {
      var ci = g % nx, cj = ((g / nx) | 0) % ny, ck = (g / (nx * ny)) | 0;
      out[0] = x0 + ci * h; out[1] = y0 + cj * h; out[2] = z0 + ck * h;
    }
    var pa = [0, 0, 0], pb = [0, 0, 0];
    function edgeVertex(ga, gb) {
      var key = ga < gb ? ga * 16777216 + gb : gb * 16777216 + ga;
      var idx = edgeVerts.get(key);
      if (idx !== undefined) return idx;
      var da = field[ga], db = field[gb];
      var t = da / (da - db);
      cornerPos(ga, pa); cornerPos(gb, pb);
      idx = verts.length / 3;
      verts.push(pa[0] + (pb[0] - pa[0]) * t,
                 pa[1] + (pb[1] - pa[1]) * t,
                 pa[2] + (pb[2] - pa[2]) * t);
      edgeVerts.set(key, idx);
      return idx;
    }

    var cg = [0, 0, 0, 0, 0, 0, 0, 0];
    for (k = 0; k < nz - 1; k++) {
      for (j = 0; j < ny - 1; j++) {
        for (i = 0; i < nx - 1; i++) {
          for (var c = 0; c < 8; c++) {
            cg[c] = (i + CORNERS[c][0]) +
                    (j + CORNERS[c][1]) * nx +
                    (k + CORNERS[c][2]) * nx * ny;
          }
          for (var tIdx = 0; tIdx < 6; tIdx++) {
            var tet = TETS[tIdx];
            var g0 = cg[tet[0]], g1 = cg[tet[1]], g2 = cg[tet[2]], g3 = cg[tet[3]];
            var inside = [];
            var outside = [];
            (field[g0] < 0 ? inside : outside).push(g0);
            (field[g1] < 0 ? inside : outside).push(g1);
            (field[g2] < 0 ? inside : outside).push(g2);
            (field[g3] < 0 ? inside : outside).push(g3);
            if (inside.length === 0 || inside.length === 4) continue;
            if (inside.length === 1 || inside.length === 3) {
              var lone = inside.length === 1 ? inside[0] : outside[0];
              var rest = inside.length === 1 ? outside : inside;
              indices.push(
                edgeVertex(lone, rest[0]),
                edgeVertex(lone, rest[1]),
                edgeVertex(lone, rest[2])
              );
            } else {
              var a = inside[0], b = inside[1], cc = outside[0], dd = outside[1];
              var vac = edgeVertex(a, cc), vbc = edgeVertex(b, cc);
              var vbd = edgeVertex(b, dd), vad = edgeVertex(a, dd);
              indices.push(vac, vbc, vbd, vac, vbd, vad);
            }
          }
        }
      }
    }

    // Relax the mesh and re-project it onto the SDF surface so it's smooth
    // but still accurate.
    var vCount = verts.length / 3;
    var neighbors = new Array(vCount);
    for (i = 0; i < indices.length; i += 3) {
      var t0 = indices[i], t1 = indices[i + 1], t2 = indices[i + 2];
      (neighbors[t0] = neighbors[t0] || []).push(t1, t2);
      (neighbors[t1] = neighbors[t1] || []).push(t0, t2);
      (neighbors[t2] = neighbors[t2] || []).push(t0, t1);
    }
    var pos = new Float32Array(verts);
    var tmp = new Float32Array(pos.length);
    for (var pass = 0; pass < 3; pass++) {
      for (i = 0; i < vCount; i++) {
        var nb = neighbors[i];
        if (!nb || nb.length === 0) {
          tmp[i * 3] = pos[i * 3]; tmp[i * 3 + 1] = pos[i * 3 + 1]; tmp[i * 3 + 2] = pos[i * 3 + 2];
          continue;
        }
        var sx = 0, sy = 0, sz = 0;
        for (j = 0; j < nb.length; j++) {
          sx += pos[nb[j] * 3]; sy += pos[nb[j] * 3 + 1]; sz += pos[nb[j] * 3 + 2];
        }
        var inv = 1 / nb.length, L = 0.55;
        tmp[i * 3] = pos[i * 3] * (1 - L) + sx * inv * L;
        tmp[i * 3 + 1] = pos[i * 3 + 1] * (1 - L) + sy * inv * L;
        tmp[i * 3 + 2] = pos[i * 3 + 2] * (1 - L) + sz * inv * L;
      }
      var eps = 0.012;
      for (i = 0; i < vCount; i++) {
        var x = tmp[i * 3], y = tmp[i * 3 + 1], z = tmp[i * 3 + 2];
        var d = handSDF(x, y, z);
        var gx = handSDF(x + eps, y, z) - handSDF(x - eps, y, z);
        var gy = handSDF(x, y + eps, z) - handSDF(x, y - eps, z);
        var gz = handSDF(x, y, z + eps) - handSDF(x, y, z - eps);
        var gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
        pos[i * 3] = x - d * gx / gl;
        pos[i * 3 + 1] = y - d * gy / gl;
        pos[i * 3 + 2] = z - d * gz / gl;
      }
    }

    // Orient every triangle against the SDF gradient so vertex normals
    // come out consistently outward.
    var geps = 0.015;
    for (i = 0; i < indices.length; i += 3) {
      var ia = indices[i] * 3, ib = indices[i + 1] * 3, ic = indices[i + 2] * 3;
      var abx = pos[ib] - pos[ia], aby = pos[ib + 1] - pos[ia + 1], abz = pos[ib + 2] - pos[ia + 2];
      var acx = pos[ic] - pos[ia], acy = pos[ic + 1] - pos[ia + 1], acz = pos[ic + 2] - pos[ia + 2];
      var nxx = aby * acz - abz * acy;
      var nyy = abz * acx - abx * acz;
      var nzz = abx * acy - aby * acx;
      var mx = (pos[ia] + pos[ib] + pos[ic]) / 3;
      var my = (pos[ia + 1] + pos[ib + 1] + pos[ic + 1]) / 3;
      var mz = (pos[ia + 2] + pos[ib + 2] + pos[ic + 2]) / 3;
      var ggx = handSDF(mx + geps, my, mz) - handSDF(mx - geps, my, mz);
      var ggy = handSDF(mx, my + geps, mz) - handSDF(mx, my - geps, mz);
      var ggz = handSDF(mx, my, mz + geps) - handSDF(mx, my, mz - geps);
      if (nxx * ggx + nyy * ggy + nzz * ggz < 0) {
        var swap = indices[i + 1];
        indices[i + 1] = indices[i + 2];
        indices[i + 2] = swap;
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(indices);
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }

  // Area-weighted random sampling of points on the mesh surface.
  function samplePoints(geo, count) {
    var pos = geo.getAttribute('position').array;
    var idx = geo.getIndex().array;
    var triCount = idx.length / 3;
    var cumArea = new Float32Array(triCount);
    var total = 0;
    for (var i = 0; i < triCount; i++) {
      var a = idx[i * 3] * 3, b = idx[i * 3 + 1] * 3, c = idx[i * 3 + 2] * 3;
      var abx = pos[b] - pos[a], aby = pos[b + 1] - pos[a + 1], abz = pos[b + 2] - pos[a + 2];
      var acx = pos[c] - pos[a], acy = pos[c + 1] - pos[a + 1], acz = pos[c + 2] - pos[a + 2];
      var cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
      total += Math.sqrt(cx * cx + cy * cy + cz * cz) * 0.5;
      cumArea[i] = total;
    }
    var out = new Float32Array(count * 3);
    for (var p = 0; p < count; p++) {
      var r = Math.random() * total;
      var lo = 0, hi = triCount - 1;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (cumArea[mid] < r) lo = mid + 1; else hi = mid;
      }
      var ta = idx[lo * 3] * 3, tb = idx[lo * 3 + 1] * 3, tc = idx[lo * 3 + 2] * 3;
      var u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      var w = 1 - u - v;
      out[p * 3] = pos[ta] * w + pos[tb] * u + pos[tc] * v;
      out[p * 3 + 1] = pos[ta + 1] * w + pos[tb + 1] * u + pos[tc + 1] * v;
      out[p * 3 + 2] = pos[ta + 2] * w + pos[tb + 2] * u + pos[tc + 2] * v;
    }
    return out;
  }

  // ---------------------------------------------------------------------

  function init() {
    var container = document.getElementById('sphere-canvas');
    if (!container || typeof THREE === 'undefined') return;

    var w = container.offsetWidth || 480;
    var h = container.offsetHeight || 480;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.z = 3.2;

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    var geo = buildHandGeometry();

    var hand = new THREE.Group();

    // Occluder: the hand surface pulled slightly inward along its normals,
    // in the page background color. It hides the far side of the network so
    // the hand reads as a solid form, and never z-fights the points.
    var occGeo = new THREE.BufferGeometry();
    var basePos = geo.getAttribute('position');
    var baseNorm = geo.getAttribute('normal');
    var sunk = new Float32Array(basePos.array.length);
    for (var vi = 0; vi < basePos.array.length; vi++) {
      sunk[vi] = basePos.array[vi] - baseNorm.array[vi] * 0.025;
    }
    occGeo.setAttribute('position', new THREE.BufferAttribute(sunk, 3));
    occGeo.setIndex(geo.getIndex());
    hand.add(new THREE.Mesh(occGeo, new THREE.MeshBasicMaterial({ color: BG })));

    // --- plexus: drifting surface points, rewired every frame ----------
    var POINT_COUNT = 860;
    var LINK_DIST = 0.135;
    var MAX_SEGS = 11000;

    var anchors = samplePoints(geo, POINT_COUNT);
    var drift = new Float32Array(POINT_COUNT * 3);
    // per-point oscillator params: frequency + phase for each axis
    var oscF = new Float32Array(POINT_COUNT * 3);
    var oscP = new Float32Array(POINT_COUNT * 3);
    for (var oi = 0; oi < POINT_COUNT * 3; oi++) {
      oscF[oi] = 1.5 + Math.random() * 2.5;
      oscP[oi] = Math.random() * Math.PI * 2;
    }

    var pointGeo = new THREE.BufferGeometry();
    var pointPos = new THREE.BufferAttribute(new Float32Array(POINT_COUNT * 3), 3);
    pointPos.setUsage(THREE.DynamicDrawUsage);
    pointGeo.setAttribute('position', pointPos);
    hand.add(new THREE.Points(pointGeo, new THREE.PointsMaterial({
      color: 0xd96a15,
      size: 0.028,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })));

    var lineGeo = new THREE.BufferGeometry();
    var linePos = new THREE.BufferAttribute(new Float32Array(MAX_SEGS * 6), 3);
    var lineCol = new THREE.BufferAttribute(new Float32Array(MAX_SEGS * 6), 3);
    linePos.setUsage(THREE.DynamicDrawUsage);
    lineCol.setUsage(THREE.DynamicDrawUsage);
    lineGeo.setAttribute('position', linePos);
    lineGeo.setAttribute('color', lineCol);
    hand.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })));

    hand.scale.set(0.92, 0.92, 0.92);
    scene.add(hand);

    var targetX = 0, targetY = 0, currentX = 0, currentY = 0, t = 0;

    document.addEventListener('mousemove', function (e) {
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.7;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.35;
    });

    window.addEventListener('resize', function () {
      var nw = container.offsetWidth;
      var nh = container.offsetHeight;
      if (!nw || !nh) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });

    // burnt orange, brightened per-link by proximity; kept dim enough that
    // additive overlaps stay orange instead of blowing out to yellow
    // linear-space color: r:g ≈ 5.5:1 is burnt orange after the renderer's
    // sRGB output encode (which boosts mid-tone greens)
    var LINE_R = 0.24, LINE_G = 0.045, LINE_B = 0.002;

    function updatePlexus() {
      var pp = pointPos.array;
      var i3;
      for (var i = 0; i < POINT_COUNT; i++) {
        i3 = i * 3;
        drift[i3] = Math.sin(t * oscF[i3] + oscP[i3]) * 0.026;
        drift[i3 + 1] = Math.sin(t * oscF[i3 + 1] + oscP[i3 + 1]) * 0.026;
        drift[i3 + 2] = Math.sin(t * oscF[i3 + 2] + oscP[i3 + 2]) * 0.026;
        pp[i3] = anchors[i3] + drift[i3];
        pp[i3 + 1] = anchors[i3 + 1] + drift[i3 + 1];
        pp[i3 + 2] = anchors[i3 + 2] + drift[i3 + 2];
      }
      pointPos.needsUpdate = true;

      var lp = linePos.array, lc = lineCol.array;
      var seg = 0;
      var maxD2 = LINK_DIST * LINK_DIST;
      for (var a = 0; a < POINT_COUNT && seg < MAX_SEGS; a++) {
        var a3 = a * 3;
        var ax = pp[a3], ay = pp[a3 + 1], az = pp[a3 + 2];
        for (var b = a + 1; b < POINT_COUNT && seg < MAX_SEGS; b++) {
          var b3 = b * 3;
          var dx = pp[b3] - ax;
          if (dx > LINK_DIST || dx < -LINK_DIST) continue;
          var dy = pp[b3 + 1] - ay, dz = pp[b3 + 2] - az;
          var d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > maxD2) continue;
          var s6 = seg * 6;
          lp[s6] = ax; lp[s6 + 1] = ay; lp[s6 + 2] = az;
          lp[s6 + 3] = pp[b3]; lp[s6 + 4] = pp[b3 + 1]; lp[s6 + 5] = pp[b3 + 2];
          var fade = 1 - Math.sqrt(d2) / LINK_DIST;
          var r = LINE_R * fade, g = LINE_G * fade, bl = LINE_B * fade;
          lc[s6] = r; lc[s6 + 1] = g; lc[s6 + 2] = bl;
          lc[s6 + 3] = r; lc[s6 + 4] = g; lc[s6 + 5] = bl;
          seg++;
        }
      }
      lineGeo.setDrawRange(0, seg * 2);
      linePos.needsUpdate = true;
      lineCol.needsUpdate = true;
    }

    function animate() {
      requestAnimationFrame(animate);
      t += 0.01;
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      updatePlexus();

      // Layered sines at unrelated frequencies: floats and rocks without a
      // visible repeat. A resting yaw keeps it off dead-on frontal so the
      // 3D depth always shows.
      hand.position.y = Math.sin(t * 0.8) * 0.09 + Math.sin(t * 1.7) * 0.03;
      hand.position.x = Math.sin(t * 0.5) * 0.05;
      hand.rotation.y = 0.35 + Math.sin(t * 0.45) * 0.45 + currentX;
      hand.rotation.x = 0.05 + Math.sin(t * 0.6) * 0.12 + Math.cos(t * 0.33) * 0.04 + currentY;
      hand.rotation.z = Math.sin(t * 0.28) * 0.06;

      var s = 0.92 * (1 + Math.sin(t * 1.1) * 0.015);
      hand.scale.set(s, s, s);

      renderer.render(scene, camera);
    }

    animate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
