import { hydrate } from '@stewie-js/core';
import { App } from './app.js';

const container = document.getElementById('app') ?? document.body;
hydrate(<App />, container);
