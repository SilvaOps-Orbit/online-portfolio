import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import { PlaystyleView } from './src/react/SteamActivityDashboard';

const steam = JSON.parse(fs.readFileSync('./data/steam.json', 'utf8'));
try {
  const html = renderToStaticMarkup(React.createElement(PlaystyleView, { steam }));
  console.log('PLAYSTYLE RENDER OK, length=', html.length);
  console.log('contains deep-dive button:', /playstyle-habit-card/.test(html));
  console.log('contains Tap to view:', /Tap to view/.test(html));
} catch (e) {
  console.error('PLAYSTYLE RENDER THREW:', e && e.message);
  console.error(e && e.stack);
  process.exit(1);
}
