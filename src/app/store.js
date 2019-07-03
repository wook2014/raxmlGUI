import { decorate, observable, computed, action, runInAction } from "mobx"
import ipcRenderer from '../app/ipcRenderer';
import parsePath from 'parse-filepath';
import cpus from 'cpus';
import { range } from 'd3-array';

export const modelTypeNames = [
  'Fast tree search',
  'ML search',
  'ML + rapid bootstrap',
  'ML + thorough bootstrap',
  'Bootstrap + consensus',
  'Ancestral states',
  'Pairwise distance',
  'RELL bootstrap',
];

export const MAX_NUM_CPUS = cpus().length;

class Input {
  filename = '';
  size = 0;
  outDir = '';

  //@computed
  get ok() {
    return this.filename !== '';
  }

  get dir() {
    return parsePath(this.filename).dir;
  }

  get base() {
    return parsePath(this.filename).base;
  }

  get name() {
    return parsePath(this.filename).name;
  }

  constructor() {
    this.listen();
  }

  listen = () => {
    ipcRenderer.on('file', this.onFile);
    ipcRenderer.on('outDir', this.onOutDir);
  }

  selectFile = () => {
    ipcRenderer.send('open-file');
  }

  selectOutDir = () => {
    ipcRenderer.send('open-dir');
  }

  openInputFile = () => {
    ipcRenderer.send('open-item', this.filename);
  }
  
  openOutDir = () => {
    ipcRenderer.send('open-item', this.outDir);
  }

  onFile = (event, data) => {
    console.log('file:', data);
    runInAction("file", () => {
      this.filename = data.filename;
      this.size = data.size;
      this.outDir = parsePath(data.filename).dir;
    });
  }

  onOutDir = (event, data) => {
    console.log('outDir:', data);
    runInAction("outDir", () => {
      this.outDir = data;
    });
  }

}

decorate(Input, {
  filename: observable,
  size: observable,
  outDir: observable,
  ok: computed,
  dir: computed,
  base: computed,
  name: computed,
})

class Model {
  constructor(parent, id) {
    this.parent = parent;
    this.id = id;
    this.outName = parent.input.name ? `${parent.input.name}${id}.tre` : '';
    this.outNamePlaceholder = `${id}.tre`;
    this.listen();
  }

  id = 0;
  
  //@observable
  type = 2;
  raxmlBinary = 'raxmlHPC-PTHREADS-SSE3-Mac';
  running = false;
  numCpu = 2;
  stdout = '';
  outName = '';
  outSubDir = '';

  //@computed
  get typeName() {
    return modelTypeNames[this.type];
  }

  get disabled() {
    return !this.parent.input.ok;
  }

  get outDir() {
    return this.parent.input.outDir;
  }

  get cpuOptions() {
    return range(2, MAX_NUM_CPUS + 1);
  }

  get args() {
    return [
      '-T', //TODO: Only for phread version
      this.numCpu,
      '-f',
      'a',
      '-x',
      '572',
      '-m',
      'GTRGAMMA',
      '-p',
      '820',
      '-N',
      '100',
      '-s',
      this.parent.input.filename,
      '-n',
      this.outName || this.outNamePlaceholder,
      '-w',
      // this.outDir,
      this.parent.input.outDir,
    ];
  }
  

  run = () => {
    this.running = true;
    const { id, args } = this;
    ipcRenderer.send('run', { id, args });
  }
  
  cancel = () => {
    this.running = false;
    ipcRenderer.send('cancel', this.id);
  }

  //@action
  setType = (index) => {
    console.log('setType:', index);
    this.type = index;
  }

  setNumCpu = (count) => {
    console.log('setNumCpu:', count);
    this.numCpu = count;
  }

  setOutName = (name) => {
    this.outName = name;
  }

  clearStdout = () => {
    this.stdout = '';
  }

  delete = () => {
    this.cancel();
    this.parent.deleteModel(this);
  }

  dispose = () => {

  }

  testStdout = () => {
    this.stdout += this.stdout.length + '\n';
  }

  listen = () => {
    //TODO: Define callbacks on the class and remove event listeners on dispose
    ipcRenderer.on('file', this.onFile);
    ipcRenderer.on('raxml-output', this.onStdout);
    ipcRenderer.on('raxml-close', (event, data) => {
      const { id, code } = data;
      console.log(`RAxML process for model ${id} closed with code ${code}`);
      if (id === this.id) {
        runInAction("raxml-close", () => {
          this.running = false;
        });
      }
    });
  }

  onFile = (event, data) => {
    this.outName = `${parsePath(data.filename).name}_${this.id}`;
  }

  onStdout = (event, data) => {
    const { id, content } = data;
    console.log('Raxml output:', data, 'this.id:', this.id, 'is this?', id === this.id);
    if (id === this.id) {
      runInAction("raxml-output", () => {
        const stdout = content.replace(`Warning, you specified a working directory via "-w"\nKeep in mind that RAxML only accepts absolute path names, not relative ones!`, "");
        this.stdout += stdout;
      });
    }
  }
}

decorate(Model, {
  type: observable,
  raxmlBinary: observable,
  running: observable,
  numCpu: observable,
  stdout: observable,
  outName: observable,
  outSubDir: observable,
  typeName: computed,
  disabled: computed,
  outDir: computed,
  args: computed,
  setType: action,
  setNumCpu: action,
  setOutName: action,
  clearStdout: action,
  delete: action,
})

class ModelList {
  models = [];
  activeIndex = 0;
  input = new Input();

  constructor() {
    this.addModel();

    ipcRenderer.on('filename', (event, filename) => {
      this.reset();
    });
  }

  get activeModel() {
    return this.models[this.activeIndex];
  }

  reset = () => {
    console.log('TODO: Reset models on new file...');
  }

  addModel = () => {
    console.log('addModel...');
    let maxId = 0;
    this.models.forEach(model => maxId = Math.max(model.id, maxId));
    this.models.push(new Model(this, maxId + 1));
    this.activeIndex = this.models.length - 1;
  }
  
  deleteModel = (model) => {
    const modelIndex = this.models.findIndex((m => m.id === model.id));
    this.models.splice(modelIndex, 1);
    // model.dispose();
    if (this.models.length === 0) {
      this.models.push(new Model(this, 1));
    }
    this.activeIndex = Math.min(this.models.length - 1, this.activeIndex);
  }

  setActive = (index) => {
    this.activeIndex = index;
  }

  deleteActive = () => {
    this.deleteModel(this.activeModel);
  }
}

decorate(ModelList, {
  models: observable,
  activeIndex: observable,
  input: observable,
  activeModel: computed,
  addModel: action,
  deleteModel: action,
  setActive: action,
  deleteActive: action,
  testStdout: action,
})

const store = new ModelList();

export default store;