String.prototype.padStart = function(n, pad = ' ') {
  const paddingValue = new Array(Math.max(n, this.length) + 1).join(pad);
  return String(paddingValue + this).slice(-paddingValue.length);
};

String.prototype.padEnd = function(n, pad = ' ') {
  const paddingValue = new Array(Math.max(n, this.length) + 1).join(pad);
  return String(this + paddingValue).slice(0, paddingValue.length);
};

String.prototype.ellipsize = function(n) {
  return (this.length > n) ? this.substr(0, n - 3) + '...' : this;
};

Object.values = object => Object.keys(object).map(v => object[v]);

Object.entries = object => Object.keys(object).map(v => [v, object[v]]);

Array.prototype.find = function(callback, thisArg) {
  for (let i = 0; i < this.length; ++i) {
    if (callback.bind(thisArg)(this[i], i)) {
      return this[i];
    }
  }
  return undefined;
};

exports = function() {
};
