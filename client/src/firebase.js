export const auth = {
  onAuthStateChanged: (callback) => {
    callback(null);
    return () => {};
  },
};
