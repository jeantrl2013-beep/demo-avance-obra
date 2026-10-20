/**
 * CALCULO DE AVANCE DE UBS — copiado de la API publica real (Apps Script).
 * armarDatos(tablas, 'dd/MM/yyyy HH:mm', CONFIG) calcula todo; publico(datos, urlFoto)
 * arma la respuesta que lee la pagina. No lo reescribas: usalo tal cual.
 */

// =========================== LOGICA PURA ==================================
// Desde aqui hasta "FIN LOGICA PURA" no se usa nada de Google: es JavaScript
// comun. Asi se puede probar fuera de Apps Script con los mismos datos.

var CONFIG = {
  ID_LIBRO: '',
  OBRA: 'DEMO',
  TIPO: 'UBS',
  ESP_PRINCIPAL: 'MODULO DE UBS',
  GPS_TOLERANCIA_M: 300,   // mas lejos que esto de la vivienda = "Por revisar"
  DIAS_GRAFICO: 14
};

/**
 * Recibe las cuatro tablas como arreglos de objetos {encabezado: valor} y la
 * fecha-hora actual como texto "dd/MM/yyyy HH:mm". Devuelve todo lo que la
 * pagina necesita, ya calculado.
 */
function armarDatos(t, ahoraTxt, cfg) {
  var hoy = isoDia(ahoraTxt);

  // ---- catalogo de fases -------------------------------------------------
  var fases = [], fasePorId = {}, esps = [], espTotal = {};
  t.catalogo.forEach(function (r) {
    if (txt(r.Obra_ID) !== cfg.OBRA || txt(r.Tipo_Estructura) !== cfg.TIPO) { return; }
    var f = { id: txt(r.ID_Fase), esp: txt(r.Especialidad),
              orden: num(r.Orden), nombre: txt(r.Nombre_Fase) };
    if (!f.id || f.orden == null) { return; }
    fases.push(f);
    fasePorId[f.id] = f;
    if (esps.indexOf(f.esp) === -1) { esps.push(f.esp); }
    espTotal[f.esp] = (espTotal[f.esp] || 0) + 1;
  });
  fases.sort(function (a, b) {
    return (esps.indexOf(a.esp) - esps.indexOf(b.esp)) || (a.orden - b.orden);
  });
  var principal = esps.indexOf(cfg.ESP_PRINCIPAL) !== -1 ? cfg.ESP_PRINCIPAL
    : esps.slice().sort(function (a, b) { return espTotal[b] - espTotal[a]; })[0];

  // ---- usuarios ----------------------------------------------------------
  var nombres = {};
  t.usuarios.forEach(function (r) {
    var id = txt(r.ID_Usuario);
    if (id) { nombres[id] = txt(r.Nombre) || id; }
  });

  // ---- padron ------------------------------------------------------------
  var ubs = [], ubsPorId = {};
  t.padron.forEach(function (r) {
    if (txt(r.Obra_ID) !== cfg.OBRA || txt(r.Tipo_Estructura) !== cfg.TIPO) { return; }
    if (txt(r.Estado_Meta) === 'Anulada') { return; }
    var u = {
      id: txt(r.ID_Unico), codigo: txt(r.Codigo_Estructura), sector: txt(r.Sector),
      beneficiario: txt(r.Beneficiario), lat: num(r.Latitud), lon: num(r.Longitud),
      notas: txt(r.Notas)
    };
    if (!u.id) { return; }
    ubs.push(u);
    ubsPorId[u.id] = u;
  });

  // ---- registros ---------------------------------------------------------
  var registros = [], revisar = [], porUbs = {};
  t.registros.forEach(function (r) {
    if (r.Obra_ID !== undefined && txt(r.Obra_ID) !== cfg.OBRA) { return; }
    var u = ubsPorId[txt(r.Estructura)];
    if (!u) { return; }

    var f = fasePorId[txt(r.Fase)] || null;
    var estado = txt(r.Estado_Fase);
    var p = parsePct(r.Porcentaje_Avance);
    if (estado === 'Terminada') { p = 1; }

    var gps = parseGps(r.Coordenada_GPS);
    var reg = {
      id: txt(r.ID_Registro), ubs: u.id, codigo: u.codigo,
      fecha: isoDia(r.Fecha), fechaReg: isoFechaHora(r.Fecha_Registro),
      esp: f ? f.esp : '', orden: f ? f.orden : null, fase: f ? f.nombre : '',
      pct: p, estado: estado, personas: num(r.Personas),
      por: txt(r.Reportado_Por), porNombre: nombres[txt(r.Reportado_Por)] || txt(r.Reportado_Por),
      gps: gps, distM: null, foto: txt(r.Foto_Evidencia), obs: txt(r.Observaciones),
      visto: txt(r.Visto_Por), vistoNombre: nombres[txt(r.Visto_Por)] || txt(r.Visto_Por)
    };
    if (gps && u.lat != null && u.lon != null) {
      reg.distM = Math.round(distanciaM(gps[0], gps[1], u.lat, u.lon));
    }

    if (!f) {
      revisar.push(item('sin-fase', reg, 'El registro no tiene fase: no suma al avance.'));
    } else if (p == null) {
      revisar.push(item('sin-pct', reg, 'Fase ' + f.orden + ' sin porcentaje de avance: cuenta como 0%.'));
    }
    if (reg.distM != null && reg.distM > cfg.GPS_TOLERANCIA_M) {
      revisar.push(item('gps', reg, 'El GPS del registro esta a ' + formatoDist(reg.distM) +
                        ' de la vivienda en el padron.'));
    }

    registros.push(reg);
    (porUbs[u.id] = porUbs[u.id] || []).push(reg);
  });

  registros.sort(function (a, b) { return cmp(b.fechaReg || b.fecha, a.fechaReg || a.fecha); });

  // ---- estado de cada UBS ------------------------------------------------
  ubs.forEach(function (u) {
    var rs = (porUbs[u.id] || []).slice().sort(function (a, b) {
      return cmp(a.fecha, b.fecha) || cmp(a.fechaReg, b.fechaReg);
    });
    u.nRegs = rs.length;
    u.esp = {};
    esps.forEach(function (e) {
      var de = rs.filter(function (x) { return x.esp === e && x.orden != null; });
      var total = espTotal[e];
      if (!de.length) {
        u.esp[e] = { max: 0, frac: 0, cerradas: 0, total: total, avance: 0, fase: '', estado: '' };
        return;
      }
      var max = 0;
      de.forEach(function (x) { if (x.orden > max) { max = x.orden; } });
      var ult = de.filter(function (x) { return x.orden === max; }).pop();
      var frac = ult.pct == null ? 0 : Math.min(1, Math.max(0, ult.pct));
      u.esp[e] = {
        max: max, frac: frac, cerradas: frac >= 1 ? max : max - 1, total: total,
        avance: (max - 1 + frac) / total, fase: ult.fase, estado: ult.estado
      };
    });
    u.avance = u.esp[principal] ? u.esp[principal].avance : 0;
    var inicio = esps.some(function (e) { return u.esp[e].max > 0; });
    var todo = esps.every(function (e) { return u.esp[e].avance >= 1; });
    u.estado = !inicio ? 'sin' : (todo ? 'concluida' : 'curso');
    u.ultima = rs.length ? rs[rs.length - 1].fecha : null;
    u.diasSin = u.ultima ? diasEntre(u.ultima, hoy) : null;
    var conFoto = rs.filter(function (x) { return x.foto; });
    u.foto = conFoto.length ? conFoto[conFoto.length - 1].id : null;
    if (u.lat == null || u.lon == null) {
      revisar.push({ tipo: 'sin-ubicacion', ubs: u.id, codigo: u.codigo, fecha: null, por: '',
                     texto: 'La vivienda no tiene coordenadas en el padron: no aparece en el mapa.' });
    }
  });

  // ---- indicadores -------------------------------------------------------
  var n = ubs.length;
  var kpi = {
    total: n,
    iniciadas: cuenta(ubs, function (u) { return u.estado !== 'sin'; }),
    principalConcluidas: cuenta(ubs, function (u) { return u.avance >= 1; }),
    avancePrincipal: n ? suma(ubs, function (u) { return u.avance; }) / n : 0,
    registros: registros.length,
    registrosHoy: cuenta(registros, function (r) { return isoDia(r.fechaReg) === hoy; }),
    registros7: cuenta(registros, function (r) {
      var d = isoDia(r.fechaReg); return d && diasEntre(d, hoy) < 7;
    }),
    sinVisto: cuenta(registros, function (r) { return !r.visto; }),
    // Solo UBS con avance real: un registro sin fase no cuenta como trabajo.
    activas7: cuenta(ubs, function (u) { return u.estado !== 'sin' && u.diasSin != null && u.diasSin < 7; })
  };
  var conAmbas = registros.filter(function (r) { return r.fecha && r.fechaReg; });
  var retrasos = conAmbas.map(function (r) { return Math.max(0, diasEntre(r.fecha, isoDia(r.fechaReg))); });
  kpi.mismoDia = retrasos.length ? cuenta(retrasos, function (d) { return d === 0; }) / retrasos.length : null;
  kpi.retrasoMedio = retrasos.length ? suma(retrasos, function (d) { return d; }) / retrasos.length : null;

  var especialidades = esps.map(function (e) {
    return { nombre: e, total: espTotal[e],
             avance: n ? suma(ubs, function (u) { return u.esp[e].avance; }) / n : 0,
             iniciadas: cuenta(ubs, function (u) { return u.esp[e].max > 0; }) };
  });

  var escalera = fases.filter(function (f) { return f.esp === principal; }).map(function (f) {
    return { orden: f.orden, nombre: f.nombre,
             alcanzaron: cuenta(ubs, function (u) { return u.esp[principal].max >= f.orden; }),
             cerradas: cuenta(ubs, function (u) { return u.esp[principal].cerradas >= f.orden; }) };
  });

  var sistemas = {};
  ubs.forEach(function (u) {
    var s = sistemas[u.sector] = sistemas[u.sector] || { sector: u.sector, total: 0, iniciadas: 0, suma: 0 };
    s.total++; s.suma += u.avance; if (u.estado !== 'sin') { s.iniciadas++; }
  });
  var porSistema = Object.keys(sistemas).sort().map(function (k) {
    var s = sistemas[k];
    return { sector: s.sector, total: s.total, iniciadas: s.iniciadas, avance: s.total ? s.suma / s.total : 0 };
  });

  var porDia = [];
  for (var i = cfg.DIAS_GRAFICO - 1; i >= 0; i--) {
    var dia = sumarDias(hoy, -i);
    porDia.push({ dia: dia, n: cuenta(registros, function (r) { return isoDia(r.fechaReg) === dia; }) });
  }

  revisar.sort(function (a, b) { return cmp(b.fecha || '', a.fecha || ''); });

  return {
    generado: isoFechaHora(ahoraTxt), hoy: hoy, obra: cfg.OBRA, principal: principal,
    gpsTolerancia: cfg.GPS_TOLERANCIA_M,
    fases: fases, especialidades: especialidades, ubs: ubs, registros: registros,
    kpi: kpi, escalera: escalera, porSistema: porSistema, porDia: porDia, revisar: revisar
  };

  function item(tipo, reg, texto) {
    return { tipo: tipo, ubs: reg.ubs, codigo: reg.codigo, fecha: reg.fecha,
             por: reg.porNombre, reg: reg.id, texto: texto };
  }
}

// ---- utilidades ----------------------------------------------------------

function txt(v) { return v == null ? '' : String(v).trim(); }

function num(v) {
  if (v == null || v === '') { return null; }
  var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** "75%", 0.75, 75 o "" -> 0.75 o null. */
function parsePct(v) {
  if (v == null || v === '') { return null; }
  if (typeof v === 'number') { return v > 1 ? v / 100 : v; }
  var s = String(v).trim();
  var n = parseFloat(s.replace('%', '').replace(',', '.'));
  if (isNaN(n)) { return null; }
  return (s.indexOf('%') !== -1 || n > 1) ? n / 100 : n;
}

/** "-9.412345, -77.531234" -> [lat, lon] o null. */
function parseGps(v) {
  var s = txt(v);
  if (!s) { return null; }
  var p = s.split(',');
  if (p.length !== 2) { return null; }
  var a = parseFloat(p[0]), b = parseFloat(p[1]);
  if (isNaN(a) || isNaN(b) || Math.abs(a) > 90 || Math.abs(b) > 180) { return null; }
  return [a, b];
}

/** Acepta "dd/mm/yyyy[ hh:mm[:ss]]" o "yyyy-mm-dd[Thh:mm]". Devuelve "yyyy-mm-ddThh:mm" o null. */
function isoFechaHora(v) {
  var s = txt(v);
  if (!s) { return null; }
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    return m[3] + '-' + dos(m[2]) + '-' + dos(m[1]) + 'T' + dos(m[4] || 0) + ':' + dos(m[5] || 0);
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) { return m[1] + '-' + m[2] + '-' + m[3] + 'T' + (m[4] || '00') + ':' + (m[5] || '00'); }
  return null;
}

function isoDia(v) { var x = isoFechaHora(v); return x ? x.slice(0, 10) : null; }

function dos(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

function diasEntre(a, b) {
  var pa = a.split('-'), pb = b.split('-');
  return Math.round((Date.UTC(+pb[0], pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], pa[1] - 1, +pa[2])) / 864e5);
}

function sumarDias(iso, n) {
  var p = iso.split('-');
  var d = new Date(Date.UTC(+p[0], p[1] - 1, +p[2] + n));
  return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate());
}

function distanciaM(la1, lo1, la2, lo2) {
  var R = 6371000, r = Math.PI / 180;
  var dla = (la2 - la1) * r, dlo = (lo2 - lo1) * r;
  var a = Math.sin(dla / 2) * Math.sin(dla / 2) +
          Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatoDist(m) { return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m + ' m'; }

function cmp(a, b) { a = a || ''; b = b || ''; return a < b ? -1 : a > b ? 1 : 0; }
function cuenta(arr, f) { var n = 0; arr.forEach(function (x) { if (f(x)) { n++; } }); return n; }
function suma(arr, f) { var s = 0; arr.forEach(function (x) { s += f(x) || 0; }); return s; }


// ==================== RESPUESTA PUBLICA (logica pura) =====================

/**
 * Arma la respuesta publica campo por campo a partir de armarDatos().
 * urlFoto(ruta) devuelve el enlace de la foto en Drive, o '' si no la hay.
 */
function publico(d, urlFoto) {
  var k = d.kpi;
  return {
    generado: d.generado, hoy: d.hoy, principal: d.principal,
    fases: d.fases, especialidades: d.especialidades, escalera: d.escalera,
    porSistema: d.porSistema, porDia: d.porDia,
    kpi: {
      total: k.total, iniciadas: k.iniciadas, principalConcluidas: k.principalConcluidas,
      avancePrincipal: k.avancePrincipal, registros: k.registros,
      registrosHoy: k.registrosHoy, registros7: k.registros7, activas7: k.activas7
    },
    ubs: d.ubs.map(function (u) {
      return {
        id: u.id, codigo: u.codigo, sector: u.sector, lat: u.lat, lon: u.lon,
        esp: u.esp, avance: u.avance, estado: u.estado, ultima: u.ultima,
        diasSin: u.diasSin, nRegs: u.nRegs
      };
    }),
    registros: d.registros.map(function (r) {
      return {
        id: r.id, ubs: r.ubs, codigo: r.codigo, fecha: r.fecha, fechaReg: r.fechaReg,
        esp: r.esp, orden: r.orden, fase: r.fase, pct: r.pct, estado: r.estado,
        foto: r.foto ? (urlFoto(r.foto) || '') : ''
      };
    })
  };
}

// ---- para Node (pruebas). Apps Script ignora este bloque. ----
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { armarDatos, txt, num, parsePct, parseGps, isoFechaHora, isoDia, dos, diasEntre, sumarDias, distanciaM, formatoDist, cmp, cuenta, suma, publico, CONFIG };
}
