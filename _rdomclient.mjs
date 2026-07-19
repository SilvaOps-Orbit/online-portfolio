import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export const createRoot = (container) => ({
  render(element) {
    try {
      const html = renderToStaticMarkup(element);
      container._html = html;
      console.log('RENDER OK, length=', html.length);
    } catch (e) {
      console.error('RENDER THREW:', e && e.message);
      console.error(e && e.stack);
      throw e;
    }
  },
});
