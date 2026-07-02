/**
 * Envuelve un controlador async para que cualquier error caiga
 * automaticamente en next(err) y lo recoja el middleware de errores.
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
