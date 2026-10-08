import * as THREE from 'three';
import fs from 'fs';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Setup basic global objects needed by FBXLoader in node
global.window = {};
global.document = {
    createElementNS: () => {
        return {
            style: {},
            getContext: () => null
        };
    }
};
global.self = {};

// Wait, using FBXLoader in Node is hard because it expects browser APIs (DOMParser, etc).
// Let's just read the file size or tell the user directly.
