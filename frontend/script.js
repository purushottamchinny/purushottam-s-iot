// Vanilla JS Controller for Standalone Frontend
document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.add('hidden');
      });
      const activePane = document.getElementById(`tab-${targetTab}`);
      if (activePane) activePane.classList.remove('hidden');
    });
  });

  // Chart setup
  let timelineChart = null;
  const ctx = document.getElementById('timelineChart')?.getContext('2d');
  if (ctx) {
    timelineChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
        datasets: [
          {
            label: 'Authorized',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: '#10b981',
            borderRadius: 4
          },
          {
            label: 'Unknown',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: '#ef4444',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
        }
      }
    });
  }

  // Stats loader
  async function loadStats() {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        document.getElementById('stat-total').textContent = data.stats.total_detections;
        document.getElementById('stat-auth').textContent = data.stats.authorized_count;
        document.getElementById('stat-unknown').textContent = data.stats.unknown_count;
        document.getElementById('stat-alerts').textContent = data.stats.unreviewed_alerts;

        const badge = document.getElementById('alerts-badge');
        if (data.stats.unreviewed_alerts > 0) {
          badge.textContent = data.stats.unreviewed_alerts;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }

        if (timelineChart && data.chart_data) {
          timelineChart.data.labels = data.chart_data.labels;
          timelineChart.data.datasets[0].data = data.chart_data.authorized;
          timelineChart.data.datasets[1].data = data.chart_data.unknown;
          timelineChart.update();
        }
      }
    } catch (err) {}
  }

  loadStats();
  setInterval(loadStats, 5000);

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  // Camera start/stop
  document.getElementById('start-cam-btn')?.addEventListener('click', async () => {
    await fetch('/api/camera/start', { method: 'POST' });
    const img = document.getElementById('live-stream-img');
    if (img) img.src = `/api/camera/feed?t=${Date.now()}`;
  });

  document.getElementById('stop-cam-btn')?.addEventListener('click', async () => {
    await fetch('/api/camera/stop', { method: 'POST' });
  });

  // Assistant ask
  const assistantForm = document.getElementById('assistant-form');
  assistantForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('assistant-input');
    const log = document.getElementById('assistant-chat-log');
    const q = input.value.trim();
    if (!q) return;

    log.innerHTML += `<div style="margin-bottom: 8px;"><strong>You:</strong> ${q}</div>`;
    input.value = '';

    const res = await fetch('/api/assistant/ask', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ question: q })
    });
    const data = await res.json();
    log.innerHTML += `<div style="margin-bottom: 8px; color: #a78bfa;"><strong>AI Assistant:</strong> ${data.answer}</div>`;
    log.scrollTop = log.scrollHeight;
  });
});
