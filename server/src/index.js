const http = require('./app.js');
const PORT = 8080;

http.listen(PORT, () => console.log(
    `2.1 :: nodejs-express-server listening on port ¯\\_(ツ)_/¯ ${PORT}`));
