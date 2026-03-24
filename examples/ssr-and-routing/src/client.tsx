import { hydrate } from '@stewie/core'
import { App } from './app.js'

const container = document.getElementById('app') ?? document.body
hydrate(<App />, container)
