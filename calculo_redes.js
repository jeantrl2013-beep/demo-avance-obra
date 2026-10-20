/**
 * CALCULO DE AVANCE DE REDES — logica pura, sin nada de Google.
 * calcularRedes(red, cfg) recibe la red (zonas y ejes con su avance en metros) y
 * devuelve lo que pinta la pagina: base de zanja, avance valido por etapa, ejes
 * "para revisar" y totales por zona y de toda la red. Sirve igual en Node y en
 * Apps Script.
 */

var CONFIG_REDES = {
  MARGEN: 0.10,   // la wincha puede pasar la base hasta este margen; mas alla = "para revisar"
  ETAPAS: [
    { id: 'exc',  nombre: 'Excavación de zanja' },
    { id: 'cama', nombre: 'Cama de apoyo' },
    { id: 'tub',  nombre: 'Instalación de tubería' },
    { id: 'tap',  nombre: 'Tapado y prueba' }
  ]
};

/**
 * red.zonas: [{id, nombre, desde}]
 * red.ejes:  [{id, zona, desde, hasta, largo, hdpe: [[ini, fin], ...], casas: [{ubs, codigo, prog}],
 *              avance: {exc, cama, tub, tap}, actualizado}]
 * largo = metros en planta; hdpe = tramos sin zanja, en progresiva del eje.
 */
function calcularRedes(red, cfg) {
  var etapas = cfg.ETAPAS;

  var ejes = red.ejes.map(function (e) {
    var hdpeM = 0;
    (e.hdpe || []).forEach(function (t) { hdpeM += t[1] - t[0]; });
    var base = redondear(Math.max(0, e.largo - hdpeM));
    var et = {}, motivos = [], alguno = false;
    etapas.forEach(function (s) {
      var medido = numero((e.avance || {})[s.id]);
      var valido = Math.min(medido, base);
      var exceso = base > 0 ? (medido - base) / base : 0;
      et[s.id] = { medido: medido, valido: valido, frac: base > 0 ? valido / base : 0, exceso: exceso };
      if (medido > 0) { alguno = true; }
      if (base > 0 && exceso > cfg.MARGEN) {
        motivos.push(s.nombre + ': ' + medido + ' m medidos sobre ' + base + ' m de base (+' +
                     Math.round(exceso * 100) + '%).');
      } else if (base === 0 && medido > 0) {
        motivos.push(s.nombre + ': ' + medido + ' m reportados en un eje que va todo en HDPE, sin zanja.');
      }
    });
    var ultima = et[etapas[etapas.length - 1].id];
    var estado = base === 0 ? 'hdpe' : !alguno ? 'sin' : ultima.frac >= 1 ? 'terminado' : 'curso';
    return {
      id: e.id, zona: e.zona, desde: e.desde, hasta: e.hasta, coords: e.coords,
      largo: redondear(e.largo), hdpe: e.hdpe || [], hdpeM: redondear(hdpeM), base: base,
      casas: (e.casas || []).slice().sort(function (a, b) { return a.prog - b.prog; }),
      etapas: et, estado: estado, revisar: motivos.length > 0, motivos: motivos,
      actualizado: e.actualizado || null
    };
  });

  var zonas = red.zonas.map(function (z) {
    var de = ejes.filter(function (e) { return e.zona === z.id; });
    return Object.assign({}, z, { ejes: de.length }, totales(de));
  });

  return {
    margen: cfg.MARGEN, etapas: etapas, estructuras: red.estructuras || [],
    zonas: zonas, ejes: ejes,
    total: Object.assign({ ejes: ejes.length }, totales(ejes)),
    revisar: ejes.filter(function (e) { return e.revisar; }).map(function (e) {
      return { eje: e.id, zona: e.zona, texto: e.motivos.join(' ') };
    })
  };

  function totales(lista) {
    var t = { largo: 0, hdpeM: 0, base: 0, etapas: {} };
    lista.forEach(function (e) { t.largo += e.largo; t.hdpeM += e.hdpeM; t.base += e.base; });
    etapas.forEach(function (s) {
      var m = 0;
      lista.forEach(function (e) { m += e.etapas[s.id].valido; });
      t.etapas[s.id] = { metros: redondear(m), frac: t.base > 0 ? m / t.base : 0 };
    });
    t.largo = redondear(t.largo); t.hdpeM = redondear(t.hdpeM); t.base = redondear(t.base);
    return t;
  }
}

function numero(v) {
  if (v == null || v === '') { return 0; }
  var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) || n < 0 ? 0 : n;
}

function redondear(x) { return Math.round(x * 10) / 10; }

// ---- para Node. Apps Script ignora este bloque. ----
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularRedes: calcularRedes, CONFIG_REDES: CONFIG_REDES };
}
