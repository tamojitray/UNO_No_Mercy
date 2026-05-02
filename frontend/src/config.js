export const API_BASE = import.meta.env.PROD 
  ? window.location.origin 
  : window.location.protocol + "//" + window.location.hostname + ":8000";
