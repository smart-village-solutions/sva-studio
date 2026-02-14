import {
  renderToReadableStream,
  renderToStaticMarkup,
  renderToString,
  resume,
  version,
} from 'react-dom/server.browser';

const ReactDOMServerCompat = {
  renderToReadableStream,
  renderToStaticMarkup,
  renderToString,
  resume,
  version,
};

export { renderToReadableStream, renderToStaticMarkup, renderToString, resume, version };
export default ReactDOMServerCompat;
