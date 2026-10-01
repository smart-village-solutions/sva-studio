declare module "*.css";
declare module "maplibre-gl/dist/maplibre-gl.css";
declare module "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url" {
  const workerUrl: string;
  export default workerUrl;
}
