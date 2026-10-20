#!/usr/bin/env node
/**
 * GENERADOR DEL DEMO — obra 100% inventada: "Centro Poblado Demo".
 *
 * Arma las cuatro tablas que en la obra real vienen de Google Sheets (catalogo,
 * usuarios, padron, registros), las pasa SIN CAMBIOS por armarDatos() y publico()
 * de calculo_avance.js, arma la red de agua ficticia con su avance y lo escribe
 * todo en datos_demo.js como window.DATOS_DEMO = {...}.
 *
 * Uso: node generar_demo.js
 * Sin dependencias. Usa una semilla fija: dos corridas dan el mismo archivo.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var calc = require('./calculo_avance.js');
var redes = require('./calculo_redes.js');

// ------------------------------------------------------------ parametros --
var SEMILLA = 20261016;
var AHORA = '16/10/2026 17:45';          // "ahora" del demo (viernes)
var DIAS = 28;                            // cuatro semanas de registros
var ORIGEN = { lat: -9.4480, lon: -77.6120 };  // sierra de Ancash; lugar inventado
var COTA_RES = 3520;                      // msnm, solo para el rotulo

var CFG = Object.assign({}, calc.CONFIG, { OBRA: 'DEMO', TIPO: 'UBS', ESP_PRINCIPAL: 'MODULO DE UBS' });

// ------------------------------------------------------------- azar fijo --
var azar = (function (s) {
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    var t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
})(SEMILLA);
function entre(a, b) { return a + (b - a) * azar(); }
function entero(a, b) { return Math.floor(entre(a, b + 1)); }
function uno(arr) { return arr[Math.floor(azar() * arr.length)]; }
function pesado(pares) {          // [[valor, peso], ...]
  var t = 0; pares.forEach(function (p) { t += p[1]; });
  var x = azar() * t;
  for (var i = 0; i < pares.length; i++) { x -= pares[i][1]; if (x <= 0) { return pares[i][0]; } }
  return pares[pares.length - 1][0];
}
function dos(n) { return (n < 10 ? '0' : '') + n; }
function r6(x) { return Math.round(x * 1e6) / 1e6; }

// ---------------------------------------------------------- geografia ----
var M_LAT = 111320, M_LON = 111320 * Math.cos(ORIGEN.lat * Math.PI / 180);
function aLatLon(p) { return [r6(ORIGEN.lat + p[1] / M_LAT), r6(ORIGEN.lon + p[0] / M_LON)]; }

// ================================================================ CATALOGO ==
var FASES = {
  'MODULO DE UBS': [
    'TRAZO Y REPLANTEO', 'EXCAVACIÓN DE ZANJAS PARA CIMIENTOS', 'CIMIENTO CORRIDO',
    'SOBRECIMIENTO', 'FALSO PISO', 'MUROS DE LADRILLO', 'COLUMNAS Y VIGA COLLAR',
    'TECHO DE CALAMINA', 'INSTALACIONES DE DESAGÜE PVC', 'INSTALACIONES DE AGUA',
    'INSTALACIONES ELÉCTRICAS', 'TARRAJEO INTERIOR Y EXTERIOR', 'PISO DE CEMENTO PULIDO',
    'PUERTA Y VENTANA', 'APARATOS SANITARIOS', 'PINTURA Y LIMPIEZA FINAL'
  ],
  'SISTEMA DE TRATAMIENTO': [
    'TRAZO DEL SISTEMA DE TRATAMIENTO', 'EXCAVACIÓN PARA BIODIGESTOR', 'SOLADO Y CAMA DE ARENA',
    'INSTALACIÓN DEL BIODIGESTOR', 'RELLENO COMPACTADO DEL BIODIGESTOR', 'CAJA DE REGISTRO',
    'TUBERÍA PVC AL BIODIGESTOR', 'CAJA DE LODOS', 'EXCAVACIÓN DE ZANJA DE INFILTRACIÓN',
    'GRAVA Y TUBERÍA PERFORADA', 'RELLENO DE ZANJA DE INFILTRACIÓN', 'PRUEBA DE FUNCIONAMIENTO'
  ],
  'LAVADERO MULTIUSOS': [
    'BASE Y PEDESTAL DEL LAVADERO', 'INSTALACIÓN DE LAVADERO Y GRIFERÍA', 'DESAGÜE DEL LAVADERO'
  ]
};
var PREFIJO = { 'MODULO DE UBS': 'M', 'SISTEMA DE TRATAMIENTO': 'T', 'LAVADERO MULTIUSOS': 'L' };
var ESPS = Object.keys(FASES);

var catalogo = [];
ESPS.forEach(function (e) {
  FASES[e].forEach(function (nombre, i) {
    catalogo.push({ Obra_ID: 'DEMO', Tipo_Estructura: 'UBS', ID_Fase: PREFIJO[e] + dos(i + 1),
                    Especialidad: e, Orden: i + 1, Nombre_Fase: nombre });
  });
});

// ================================================================ USUARIOS ==
var usuarios = [
  { ID_Usuario: 'U01', Nombre: 'MAESTRO', Rol: 'Campo' },
  { ID_Usuario: 'U02', Nombre: 'ING1', Rol: 'Supervisión' },
  { ID_Usuario: 'U03', Nombre: 'ING2', Rol: 'Supervisión' }
];

// ==================================================================== RED ==
// Coordenadas en metros (x al este, y al norte) desde el reservorio. La red baja
// hacia el suroeste. Cada eje va aguas abajo: su progresiva 0+000 esta en el primer
// punto. Un eje solo se corta en una tee de red (T#) o en una CRP; las casas no lo cortan.
var NUDOS = {
  'RES-01': [0, 0], 'T1': [-380, -170], 'T2': [-470, -330], 'CRP-01': [-640, -560],
  'CRP-02': [-930, 30], 'T3': [-760, -930], 'CRP-03': [-1010, -1260], 'T4': [-1180, 210],
  'T5': [-1120, -1530], 'CRP-04': [-1390, -1760], 'T6': [-1560, -1960]
};
var ESTRUCTURAS = [
  { id: 'RES-01', tipo: 'reservorio', nombre: 'Reservorio', cota: COTA_RES },
  { id: 'CRP-01', tipo: 'crp', nombre: 'CRP-01', cota: COTA_RES - 52 },
  { id: 'CRP-02', tipo: 'crp', nombre: 'CRP-02', cota: COTA_RES - 48 },
  { id: 'CRP-03', tipo: 'crp', nombre: 'CRP-03', cota: COTA_RES - 101 },
  { id: 'CRP-04', tipo: 'crp', nombre: 'CRP-04', cota: COTA_RES - 149 }
];
var ZONAS = [
  { id: 'Z1', nombre: 'Zona 1', desde: 'RES-01' },
  { id: 'Z2', nombre: 'Zona 2', desde: 'CRP-01' },
  { id: 'Z3', nombre: 'Zona 3', desde: 'CRP-02' },
  { id: 'Z4', nombre: 'Zona 4', desde: 'CRP-03' },
  { id: 'Z5', nombre: 'Zona 5', desde: 'CRP-04' }
];
// casas: cuantas viviendas empalman en el eje; fin: el eje acaba en la ultima casa.
// hdpe: tramos sin zanja como fraccion del largo (ladera).
// av: avance de cada etapa como fraccion de la base (la wincha puede pasarse).
var SISTEMA = { Z1: 'Sistema 1', Z3: 'Sistema 1', Z2: 'Sistema 2', Z4: 'Sistema 2', Z5: 'Sistema 2' };
var EJES = [
  { id: 'Z1-E1', zona: 'Z1', de: 'RES-01', a: 'T1', via: [[-130, -40], [-260, -120]], casas: 3,
    av: [1.014, 1.014, 1.014, 1.014], dia: 3 },
  { id: 'Z1-E2', zona: 'Z1', de: 'T1', a: 'T2', via: [[-430, -250]], casas: 2,
    av: [1, 1, 1, 1], dia: 6 },
  { id: 'Z1-E3', zona: 'Z1', de: 'T2', a: 'CRP-01', via: [[-560, -440]], casas: 2,
    av: [1.03, 1.03, 1.03, 0.62], dia: 0 },
  { id: 'Z1-E4', zona: 'Z1', de: 'T2', a: 'fin', via: [[-330, -420], [-230, -560], [-120, -640]], casas: 4,
    av: [1, 0.9, 0.78, 0], dia: 1 },
  { id: 'Z1-E5', zona: 'Z1', de: 'T1', a: 'CRP-02', via: [[-520, -110], [-680, -70], [-820, -10]], casas: 3,
    hdpe: [[0.40, 0.62]], av: [1.02, 1, 0.71, 0.34], dia: 0 },
  { id: 'Z2-E1', zona: 'Z2', de: 'CRP-01', a: 'T3', via: [[-700, -700], [-740, -820]], casas: 2,
    av: [1.02, 0.95, 0.88, 0], dia: 1 },
  { id: 'Z2-E2', zona: 'Z2', de: 'T3', a: 'CRP-03', via: [[-860, -1060], [-940, -1160]], casas: 3,
    av: [0.44, 0.3, 0.14, 0], dia: 0 },
  { id: 'Z2-E3', zona: 'Z2', de: 'T3', a: 'fin', via: [[-620, -1010], [-500, -1120], [-420, -1200]], casas: 4,
    av: [1.124, 0.8, 0.52, 0], dia: 2 },
  { id: 'Z3-E1', zona: 'Z3', de: 'CRP-02', a: 'T4', via: [[-1020, 90], [-1100, 160]], casas: 2,
    av: [0.37, 0, 0, 0], dia: 0 },
  { id: 'Z3-E2', zona: 'Z3', de: 'T4', a: 'fin', via: [[-1260, 110], [-1350, 0], [-1440, -90]], casas: 4,
    av: [0, 0, 0, 0] },
  { id: 'Z3-E3', zona: 'Z3', de: 'T4', a: 'fin', via: [[-1220, 290]], casas: 1,
    hdpe: [[0, 1]], av: [0, 0, 0, 0] },
  { id: 'Z4-E1', zona: 'Z4', de: 'CRP-03', a: 'T5', via: [[-1060, -1400]], casas: 1,
    av: [0.21, 0, 0, 0], dia: 0 },
  { id: 'Z4-E2', zona: 'Z4', de: 'T5', a: 'CRP-04', via: [[-1240, -1650]], casas: 2,
    av: [0, 0, 0, 0] },
  { id: 'Z4-E3', zona: 'Z4', de: 'T5', a: 'fin', via: [[-1000, -1650], [-900, -1760]], casas: 3,
    av: [0, 0, 0, 0] },
  { id: 'Z5-E1', zona: 'Z5', de: 'CRP-04', a: 'T6', via: [[-1470, -1870]], casas: 1,
    av: [0, 0, 0, 0] },
  { id: 'Z5-E2', zona: 'Z5', de: 'T6', a: 'fin', via: [[-1720, -1900], [-1880, -1960]], casas: 2,
    av: [0, 0, 0, 0] },
  { id: 'Z5-E3', zona: 'Z5', de: 'T6', a: 'fin', via: [[-1600, -2120], [-1660, -2260]], casas: 1,
    av: [0, 0, 0, 0] }
];

function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

/** Densifica la polilinea cada ~20 m con una ondulacion suave, como sigue el terreno. */
function ondular(puntos) {
  var fase1 = entre(0, 6.28), fase2 = entre(0, 6.28), amp = entre(4, 9);
  var out = [puntos[0]];
  for (var i = 0; i < puntos.length - 1; i++) {
    var a = puntos[i], b = puntos[i + 1], L = dist(a, b), n = Math.max(1, Math.round(L / 20));
    var nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    for (var k = 1; k <= n; k++) {
      var t = k / n, s = Math.sin(Math.PI * t);
      var o = k === n ? 0 : s * amp * (Math.sin(t * 7 + fase1) + 0.5 * Math.sin(t * 17 + fase2));
      out.push([a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o]);
    }
  }
  return out;
}

/** Punto y direccion a una progresiva dada (en metros) sobre la polilinea. */
function enProgresiva(pts, cum, d) {
  for (var i = 1; i < pts.length; i++) {
    if (cum[i] >= d || i === pts.length - 1) {
      var L = cum[i] - cum[i - 1] || 1, t = Math.max(0, Math.min(1, (d - cum[i - 1]) / L));
      var a = pts[i - 1], b = pts[i];
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
               dir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
    }
  }
}

var finN = 0, casasRed = [], ejesRed = [];
EJES.forEach(function (e) {
  var hasta = e.a === 'fin' ? 'FIN-' + (++finN) : e.a;
  var ini = NUDOS[e.de];
  var fin = e.a === 'fin' ? e.via[e.via.length - 1] : NUDOS[e.a];
  var via = e.a === 'fin' ? e.via.slice(0, -1) : e.via;
  var pts = ondular([ini].concat(via, [fin]));
  var cum = [0];
  for (var i = 1; i < pts.length; i++) { cum.push(cum[i - 1] + dist(pts[i - 1], pts[i])); }
  var largo = Math.round(cum[cum.length - 1] * 10) / 10;
  var hdpe = (e.hdpe || []).map(function (h) {
    return [Math.round(h[0] * largo), h[1] >= 1 ? largo : Math.round(h[1] * largo)];
  });
  e.hasta = hasta; e.largo = largo; e.pts = pts; e.cum = cum; e.hdpeM = hdpe;

  // casas empalmadas: repartidas a lo largo; si el eje acaba en casa, la ultima va al final
  for (var c = 0; c < e.casas; c++) {
    var prog;
    if (e.a === 'fin' && c === e.casas - 1) { prog = largo; }
    else {
      var tramo = (e.a === 'fin' ? largo * 0.85 : largo * 0.9) / e.casas;
      prog = Math.round(tramo * (c + 0.5) + entre(-0.25, 0.25) * tramo + (e.a === 'fin' ? 0 : largo * 0.05));
    }
    prog = Math.max(8, Math.min(largo, Math.round(prog)));
    var q = enProgresiva(pts, cum, prog);
    var lado = azar() < 0.5 ? -1 : 1, off = prog === Math.round(largo) && e.a === 'fin' ? entre(12, 22) : entre(22, 70);
    var casa = prog >= largo - 1 && e.a === 'fin'
      ? [q.p[0] + q.dir[0] * off, q.p[1] + q.dir[1] * off]
      : [q.p[0] - q.dir[1] * off * lado, q.p[1] + q.dir[0] * off * lado];
    casasRed.push({ eje: e.id, zona: e.zona, prog: Math.min(Math.round(prog), Math.round(largo)),
                    xy: casa, empalme: q.p });
  }
});

// codigos de UBS: por sistema y siguiendo la red aguas abajo
casasRed.sort(function (a, b) {
  return SISTEMA[a.zona] < SISTEMA[b.zona] ? -1 : SISTEMA[a.zona] > SISTEMA[b.zona] ? 1
    : a.zona < b.zona ? -1 : a.zona > b.zona ? 1 : a.eje < b.eje ? -1 : a.eje > b.eje ? 1 : a.prog - b.prog;
});
casasRed.forEach(function (c, i) {
  c.codigo = 'UBS-' + ('00' + (i + 1)).slice(-3);
  c.id = 'DEMO-' + c.codigo;
  c.sector = SISTEMA[c.zona];
  c.ll = aLatLon(c.xy);
});

// ================================================================= PADRON ==
var padron = casasRed.map(function (c, i) {
  return { Obra_ID: 'DEMO', Tipo_Estructura: 'UBS', ID_Unico: c.id, Codigo_Estructura: c.codigo,
           Sector: c.sector, Beneficiario: 'Familia ' + dos(i + 1) + ' (ficticia)',
           Latitud: c.ll[0], Longitud: c.ll[1], Estado_Meta: 'Vigente', Notas: '' };
});
// una meta anulada, como pasa en campo: armarDatos la descarta
padron.push({ Obra_ID: 'DEMO', Tipo_Estructura: 'UBS', ID_Unico: 'DEMO-UBS-041', Codigo_Estructura: 'UBS-041',
              Sector: 'Sistema 2', Beneficiario: 'Familia 41 (ficticia)', Latitud: '', Longitud: '',
              Estado_Meta: 'Anulada', Notas: 'La familia desistió antes del trazo.' });

// ============================================================== REGISTROS ==
// Fechas como en Sheets: "dd/MM/yyyy" y "dd/MM/yyyy HH:mm:ss".
var hoyIso = calc.isoDia(AHORA);
var ahoraMin = toMin(AHORA.slice(11));
function diaIso(i) { return calc.sumarDias(hoyIso, i - (DIAS - 1)); }      // i = 0..DIAS-1
function dmy(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4); }
function hm(min) { return dos(Math.floor(min / 60)) + ':' + dos(min % 60); }
function toMin(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
function diaSemana(iso) { var p = iso.split('-'); return new Date(Date.UTC(+p[0], p[1] - 1, +p[2])).getUTCDay(); }

// Perfiles: el modulo piloto (el primero que se levanta), adelantadas, a ritmo, que recien empiezan, quietas (pararon) y sin iniciar.
var PERFILES = [];
(function () {
  var orden = casasRed.map(function (c) { return c.id; });
  // mezcla fija para que los perfiles no sigan el orden de los codigos
  for (var i = orden.length - 1; i > 0; i--) { var j = Math.floor(azar() * (i + 1)); var t = orden[i]; orden[i] = orden[j]; orden[j] = t; }
  var reparto = [['piloto', 1], ['adelantada', 2], ['ritmo', 8], ['inicio', 10], ['quieta', 4], ['sin', 15]];
  var k = 0;
  reparto.forEach(function (r) { for (var n = 0; n < r[1]; n++) { PERFILES.push({ id: orden[k++], tipo: r[0] }); } });
})();
var PESO = { piloto: 16, adelantada: 9, ritmo: 2.2, inicio: 1.6, quieta: 1.8 };
var VENTANA = { piloto: [0, DIAS], adelantada: [0, DIAS], ritmo: [0, DIAS], inicio: [13, DIAS], quieta: [0, 9] };

var estadoUbs = {};
PERFILES.forEach(function (p, i) {
  var v = VENTANA[p.tipo];
  estadoUbs[p.id] = { tipo: p.tipo, desde: v ? (p.tipo === 'ritmo' ? entero(0, 9) : v[0] + (p.tipo === 'inicio' ? entero(0, 8) : 0)) : null,
                      hasta: v ? v[1] : null, esp: { M: [1, 0], T: [1, 0], L: [1, 0] } };
});
var porId = {};
casasRed.forEach(function (c) { porId[c.id] = c; });

var registros = [], nReg = 0;
var OBS = ['', '', '', '', '', 'Lluvia en la tarde, se paró temprano.', 'Falta cemento, se avanzó lo que se pudo.',
           'La familia apoyó con mano de obra no calificada.', 'Se esperó el agregado hasta el mediodía.',
           'Terreno rocoso, avance lento.'];

function nuevoRegistro(dia, c, campos) {
  nReg++;
  var fecha = diaIso(dia);
  var hora = entero(9 * 60, 17 * 60 + 30);
  var retraso = pesado([[0, 80], [1, 15], [2, 5]]);
  var fReg = calc.sumarDias(fecha, retraso), mReg = retraso ? entero(6 * 60 + 30, 9 * 60) : Math.min(hora + entero(5, 50), 18 * 60 + 40);
  if (fReg > hoyIso || (fReg === hoyIso && mReg > ahoraMin)) { fReg = fecha; mReg = Math.min(hora + 5, ahoraMin - 1); }
  if (fecha === hoyIso && hora >= ahoraMin) { hora = ahoraMin - entero(30, 300); mReg = Math.min(hora + 10, ahoraMin - 1); }
  var gps = [c.ll[0] + entre(-1, 1) * 0.00012, c.ll[1] + entre(-1, 1) * 0.00012];  // ~10 m de ruido
  var antiguo = calc.diasEntre(fReg, hoyIso) >= 2;
  return Object.assign({
    ID_Registro: 'R' + ('000' + nReg).slice(-4), Obra_ID: 'DEMO', Estructura: c.id,
    Fase: '', Estado_Fase: '', Porcentaje_Avance: '',
    Fecha: dmy(fecha), Fecha_Registro: dmy(fReg) + ' ' + hm(mReg) + ':' + dos(entero(0, 59)),
    Personas: entero(2, 6), Reportado_Por: pesado([['U01', 60], ['U02', 25], ['U03', 15]]),
    Coordenada_GPS: gps[0].toFixed(6) + ', ' + gps[1].toFixed(6),
    Foto_Evidencia: '', Observaciones: uno(OBS),
    Visto_Por: antiguo && azar() < 0.85 ? uno(['U02', 'U03']) : ''
  }, campos);
}

/** Un reporte de avance: sigue la fase en curso de la especialidad, siempre en orden. */
function reportar(dia, id) {
  var st = estadoUbs[id], c = porId[id];
  var m = st.esp.M;
  var opciones = [['M', 10]];
  if (m[0] > (st.tipo === 'piloto' ? 13 : 6) && st.esp.T[0] <= FASES['SISTEMA DE TRATAMIENTO'].length) { opciones.push(['T', 6]); }
  if (m[0] > 14 && st.esp.L[0] <= FASES['LAVADERO MULTIUSOS'].length) { opciones.push(['L', 5]); }
  if (m[0] > FASES['MODULO DE UBS'].length) { opciones = opciones.filter(function (o) { return o[0] !== 'M'; }); }
  if (!opciones.length) { return null; }
  var e = pesado(opciones), s = st.esp[e];
  var estado, p;
  if (s[1] === 0 && azar() < (st.tipo === 'piloto' || st.tipo === 'adelantada' ? 0.75 : 0.6)) { estado = 'Terminada'; p = 1; }
  else if (s[1] === 0) { estado = 'Iniciada'; p = Math.round(entre(0.2, 0.5) * 20) / 20; }
  else if (s[1] < 0.6 && azar() < 0.5) { estado = 'Avanzada'; p = Math.round(entre(0.6, 0.9) * 20) / 20; }
  else { estado = 'Terminada'; p = 1; }
  var reg = nuevoRegistro(dia, c, { Fase: e + dos(s[0]), Estado_Fase: estado, Porcentaje_Avance: p });
  if (azar() < 0.72) { reg.Foto_Evidencia = 'Registros_Images/' + reg.ID_Registro + '.Foto_Evidencia.jpg'; }
  if (p >= 1) { s[0]++; s[1] = 0; } else { s[1] = p; }
  return reg;
}

for (var dia = 0; dia < DIAS; dia++) {
  var dow = diaSemana(diaIso(dia));
  var n = dow === 0 ? 0 : dow === 6 ? 3 : entero(3, 5);
  for (var r = 0; r < n; r++) {
    var activos = PERFILES.filter(function (p) {
      var st = estadoUbs[p.id];
      return st.desde != null && dia >= st.desde && dia < st.hasta;
    }).map(function (p) { return [p.id, PESO[p.tipo]]; });
    if (!activos.length) { continue; }
    var reg = reportar(dia, pesado(activos));
    if (reg) { registros.push(reg); }
  }
}

// Lo que en la realidad queda "por revisar":
// 1) registros sin fase (una visita, una entrega de material)
var sinIniciar = PERFILES.filter(function (p) { return p.tipo === 'sin'; }).map(function (p) { return porId[p.id]; });
[[6, 'Se entregó material (cemento y ladrillo) en la vivienda.'],
 [15, 'Visita de coordinación con la familia para el trazo.'],
 [22, 'Se dejó la tubería de desagüe en la vivienda.'],
 [26, 'Reunión con la familia: piden mover el módulo unos metros.']].forEach(function (x, i) {
  registros.push(nuevoRegistro(x[0], sinIniciar[i], { Observaciones: x[1] }));
});
// 2) GPS lejos de la vivienda: reportados desde el almacen o el camino
var conFase = registros.filter(function (x) { return x.Fase; });
[0.15, 0.48, 0.81].forEach(function (f) {
  var x = conFase[Math.floor(f * conFase.length)];
  var c = porId[x.Estructura], dLat = entre(0.004, 0.007) * (azar() < 0.5 ? -1 : 1), dLon = entre(0.003, 0.006);
  x.Coordenada_GPS = (c.ll[0] + dLat).toFixed(6) + ', ' + (c.ll[1] + dLon).toFixed(6);
  x.Observaciones = 'Reportado al volver al almacén.';
});
// 3) un avance parcial sin porcentaje
var parcial = conFase.filter(function (x) { return x.Estado_Fase === 'Iniciada'; })[2];
if (parcial) { parcial.Estado_Fase = 'Avanzada'; parcial.Porcentaje_Avance = ''; }

registros.sort(function (a, b) { return a.ID_Registro < b.ID_Registro ? -1 : 1; });

// ============================================================= CALCULO UBS ==
var tablas = { catalogo: catalogo, usuarios: usuarios, padron: padron, registros: registros };
var datos = calc.armarDatos(tablas, AHORA, CFG);
// No hay fotos reales: la pagina dibuja una ilustracion rotulada "foto de ejemplo".
var salida = calc.publico(datos, function (ruta) { return ruta ? 'ejemplo:' + ruta : ''; });

// ========================================================= CALCULO REDES ==
var casasPorEje = {};
casasRed.forEach(function (c) {
  (casasPorEje[c.eje] = casasPorEje[c.eje] || []).push({ ubs: c.id, codigo: c.codigo, prog: c.prog,
                                                          empalme: aLatLon(c.empalme) });
});
var red = {
  zonas: ZONAS,
  estructuras: ESTRUCTURAS.map(function (s) {
    var ll = aLatLon(NUDOS[s.id]);
    return Object.assign({}, s, { lat: ll[0], lon: ll[1] });
  }),
  ejes: EJES.map(function (e) {
    var base = e.largo - e.hdpeM.reduce(function (s, h) { return s + h[1] - h[0]; }, 0);
    var av = {};
    redes.CONFIG_REDES.ETAPAS.forEach(function (s, i) {   // la wincha da metros enteros
      av[s.id] = e.av[i] >= 1 ? Math.ceil(base * e.av[i]) : Math.round(base * e.av[i]);
    });
    return {
      id: e.id, zona: e.zona, desde: e.de, hasta: e.hasta, largo: e.largo, hdpe: e.hdpeM,
      coords: e.pts.map(aLatLon), casas: casasPorEje[e.id] || [], avance: av,
      actualizado: e.dia != null && e.av[0] > 0 ? calc.sumarDias(hoyIso, -e.dia) : null
    };
  })
};
salida.redes = redes.calcularRedes(red, redes.CONFIG_REDES);
salida.demo = true;

// ================================================================ ESCRITURA ==
var destino = path.join(__dirname, 'datos_demo.js');
fs.writeFileSync(destino,
  '// Generado por generar_demo.js. Datos 100% ficticios. No editar a mano.\n' +
  'window.DATOS_DEMO = ' + JSON.stringify(salida) + ';\n');

// --------------------------------------------------------------- resumen --
var k = salida.kpi, t = salida.redes.total;
var tipos = {};
datos.revisar.forEach(function (x) { tipos[x.tipo] = (tipos[x.tipo] || 0) + 1; });
console.log('Escrito ' + path.relative(process.cwd(), destino) + ' (' + Math.round(fs.statSync(destino).size / 1024) + ' kB)');
console.log('UBS: ' + k.total + ' · iniciadas ' + k.iniciadas + ' · módulos concluidos ' + k.principalConcluidas +
            ' · avance del módulo ' + (k.avancePrincipal * 100).toFixed(1) + '% · ' + k.registros + ' registros');
console.log('Por revisar (armarDatos): ' + JSON.stringify(tipos));
console.log('Red: ' + t.ejes + ' ejes · ' + (t.largo / 1000).toFixed(2) + ' km en planta · ' + t.hdpeM +
            ' m HDPE · zanja base ' + t.base + ' m');
salida.redes.etapas.forEach(function (s) {
  console.log('  ' + s.nombre + ': ' + t.etapas[s.id].metros + ' m (' + (t.etapas[s.id].frac * 100).toFixed(1) + '%)');
});
console.log('Ejes para revisar: ' + salida.redes.revisar.map(function (x) { return x.eje; }).join(', '));
