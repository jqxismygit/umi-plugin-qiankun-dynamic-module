export function render(oldRender: Function) {
  oldRender();
}

window.lodash = {
  get: () => {
    console.log('get----->>');
  },
};
