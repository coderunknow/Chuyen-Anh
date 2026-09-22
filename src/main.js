import './styles.css';
import { createApp } from './app.js';

const root = document.getElementById('app');
createApp(root).catch(err => {
  console.error(err);
  root.innerHTML = `<div style="padding:40px;text-align:center"><h2>Lỗi khởi tạo app</h2><p>${err.message}</p><pre style="text-align:left;background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto">${err.stack}</pre></div>`;
});
