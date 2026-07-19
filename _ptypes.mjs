import fs from 'fs';
const raw = fs.readFileSync('./data/steam.json', 'utf8');
const steam = JSON.parse(raw);
export const getPortfolioConfig = () => ({ steam });
