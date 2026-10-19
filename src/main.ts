import { App } from './app';
import { browserStore } from './storage/store';
import './styles.css';

const root = document.getElementById('app');
if (root) {
  const app = new App(browserStore(), root);
  app.init();
}
