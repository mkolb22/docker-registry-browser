/* Subtle Particle Network Background */
(function() {
    'use strict';

    // Respect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var canvas, ctx, particles, animId;
    var PARTICLE_COUNT = 25;
    var LINE_DIST = 120;
    var SPEED = 0.3;
    var mouseX = -1000, mouseY = -1000;

    function init() {
        canvas = document.getElementById('particle-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        resize();
        createParticles();
        animate();

        window.addEventListener('resize', resize);
        document.addEventListener('mousemove', function(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createParticles() {
        particles = [];
        for (var i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * SPEED,
                vy: (Math.random() - 0.5) * SPEED,
                r: Math.random() * 2 + 1
            });
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update and draw particles
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];

            // Subtle mouse attraction
            var dx = mouseX - p.x;
            var dy = mouseY - p.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200 && dist > 0) {
                p.vx += dx / dist * 0.02;
                p.vy += dy / dist * 0.02;
            }

            // Dampen velocity
            p.vx *= 0.99;
            p.vy *= 0.99;

            p.x += p.vx;
            p.y += p.vy;

            // Boundary bounce
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            p.x = Math.max(0, Math.min(canvas.width, p.x));
            p.y = Math.max(0, Math.min(canvas.height, p.y));

            // Draw particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(82, 139, 255, 0.15)';
            ctx.fill();
        }

        // Draw lines between nearby particles
        for (var a = 0; a < particles.length; a++) {
            for (var b = a + 1; b < particles.length; b++) {
                var ddx = particles[a].x - particles[b].x;
                var ddy = particles[a].y - particles[b].y;
                var d = Math.sqrt(ddx * ddx + ddy * ddy);
                if (d < LINE_DIST) {
                    var alpha = (1 - d / LINE_DIST) * 0.08;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.strokeStyle = 'rgba(82, 139, 255, ' + alpha + ')';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        animId = requestAnimationFrame(animate);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
