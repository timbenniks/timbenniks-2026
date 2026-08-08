/**
 * Page visual editor entry — boots modular runtime.
 * Preserves WebMCP contract: window.__tbVisualEditor, tb-visual-editor-ready.
 */
import { bootEditor } from './editor/runtime.js';

bootEditor();
