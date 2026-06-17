/**
 * local server entry file, for local development
 */
import app from './app.js';
import { initSocketIO } from './services/socket.js';
import { initCronJobs } from './services/cron.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);

  console.log('正在初始化 Socket.IO...');
  initSocketIO(server);
  console.log('Socket.IO 初始化完成');

  console.log('正在初始化定时任务...');
  initCronJobs();
  console.log('定时任务初始化完成');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
