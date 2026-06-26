(function () {
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

    var geo = new THREE.IcosahedronGeometry(1, 3);
    var edges = new THREE.EdgesGeometry(geo);
    var mat = new THREE.LineBasicMaterial({ color: 0xbf5700, transparent: true, opacity: 0.8 });
    var sphere = new THREE.LineSegments(edges, mat);
    scene.add(sphere);

    var targetX = 0, targetY = 0, currentX = 0, currentY = 0, autoRot = 0;

    document.addEventListener('mousemove', function (e) {
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.6;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.3;
    });

    window.addEventListener('resize', function () {
      var nw = container.offsetWidth;
      var nh = container.offsetHeight;
      if (!nw || !nh) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });

    function animate() {
      requestAnimationFrame(animate);
      autoRot += 0.004;
      currentX += (targetX - currentX) * 0.04;
      currentY += (targetY - currentY) * 0.04;
      sphere.rotation.y = autoRot + currentX;
      sphere.rotation.x = currentY;
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
