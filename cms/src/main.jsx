import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { store } from './store';
import { UiProvider } from './context/UiContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <UiProvider>
          <App />
        </UiProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
