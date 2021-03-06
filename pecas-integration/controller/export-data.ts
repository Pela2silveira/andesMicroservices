import fs = require('fs');
import async = require('async');
import * as moment from 'moment';
import * as sql from 'mssql';
import * as configPrivate from '../config.private';
import { getEfector } from '../service/organizacion.service';
import { getEspecialidades } from '../service/especialidades.service';
import { log } from '@andes/log';


let poolTurnos;
const config = {
    user: configPrivate.conSqlPecas.auth.user,
    password: configPrivate.conSqlPecas.auth.password,
    server: configPrivate.conSqlPecas.serverSql.server,
    database: configPrivate.conSqlPecas.serverSql.database,
    connectionTimeout: 10000,
    requestTimeout: 45000
};
const type = 'PECAS-' + (new Date()).toISOString();
const outputFile = type + '.json';

/**
 * Actualiza la tabla pecas_consolidado de la BD Andes
 *
 * @export consultaPecas()
 * @returns resultado
 */
export async function setInPecas(agenda) {
    try {
        poolTurnos = await new sql.ConnectionPool(config).connect();
    } catch (ex) {
        let fakeRequest = {
            user: {
                usuario: 'msPecas',
                app: 'integracion-pecas',
                organizacion: 'sss'
            },
            ip: 'localhost',
            connection: {
                localAddress: ''
            }
        };
        await log(fakeRequest, 'microservices:integration:pecas', undefined, ex, null);
        return ex;
    }

    let a = agenda;
    // Se recorren los turnos
    for (let i = 0; i < a.bloques.length; i++) {
        let b = a.bloques[i];
        for (let j = 0; j < b.turnos.length; j++) {
            let t = a.bloques[i].turnos[j];
            await auxiliar(a, b, t);
        }
    }

    // Se recorren los sobreturnos

    for (let i = 0; i < a.sobreturnos.length; i++) {
        let t = a.sobreturnos[i];
        await auxiliar(a, null, t);
    }

    // Queda pendiente para más adelante.

    // let profesionales = a.profesionales;
    // let profesionalesEspecialidades = [];
    // if (profesionales) {
    //     for (let i = 0; i < profesionales.length; i++) {
    //         let data = await profesionalEspecialidades(profesionales[i]);
    //         profesionalesEspecialidades.push(data);
    //     }
    // }
}

// castea cada turno asignado y lo inserta en la tabla Sql
// async function auxiliar(a: any, b: any, t: any, profesionalesEspecialidades) {
async function auxiliar(a: any, b: any, t: any) {
    let turno: any = {};
    let efector: any = {};
    turno.sobreturno = (b !== null) ? 'NO' : 'SI';
    try {
        // Chequear si el turno existe en sql PECAS y depeniendo de eso hacer un insert o  un update
        turno.tipoTurno = t.tipoTurno ? (t.tipoTurno === 'profesional' ? 'autocitado' : (t.tipoTurno === 'gestion' ? 'conllave' : t.tipoTurno)) : 'Sin datos';
        turno.estadoTurno = t.estado;
        let turnoConPaciente = t.estado === 'asignado' && t.paciente;
        let organizacion: any = await getEfector(a.organizacion.id);
        efector = {
            tipoEfector: organizacion.tipoEstablecimiento ? organizacion.tipoEstablecimiento.nombre : null,
            codigo: organizacion.codigo.sips ? organizacion.codigo.sips : null
        };
        let idEfector = efector && efector.codigo ? parseInt(efector.codigo, 10) : null;
        let tipoEfector = efector && efector.tipoEfector ? efector.tipoEfector : null;
        turno.tipoPrestacion = (turnoConPaciente && t.tipoPrestacion && t.tipoPrestacion.term) ? t.tipoPrestacion.term : null;
        turno.idEfector = idEfector;
        turno.Organizacion = a.organizacion.nombre;
        turno.idAgenda = a._id;
        turno.FechaAgenda = moment(a.horaInicio).format('YYYYMMDD');
        turno.HoraAgenda = moment(a.horaInicio).format('HH:mm').toString();
        turno.estadoAgenda = a.estado;
        turno.numeroBloque = a.bloques.indexOf(b);
        turno.accesoDirectoProgramado = (b && b.accesoDirectoProgramado) ? b.accesoDirectoProgramado : null;
        turno.reservadoProfesional = (b && b.reservadoProfesional) ? b.reservadoProfesional : null;
        turno.reservadoGestion = (b && b.reservadoGestion) ? b.reservadoGestion : null;
        turno.accesoDirectoDelDia = (b && b.accesoDirectoDelDia) ? b.accesoDirectoDelDia : null;
        turno.idTurno = String(t._id);
        turno.FechaConsulta = moment(t.horaInicio).format('YYYYMMDD');
        turno.HoraTurno = moment(t.horaInicio).format('HH:mm').toString();
        turno.Periodo = parseInt(moment(t.horaInicio).format('YYYYMM').toString(), 10);
        turno.DNI = turnoConPaciente ? Number(t.paciente.documento) : null;
        turno.Apellido = turnoConPaciente ? t.paciente.apellido : null;
        turno.Apellido = turnoConPaciente ? turno.Apellido.toString().replace('\'', '\'\'') : null;
        turno.Nombres = turnoConPaciente ? t.paciente.nombre.toString().replace('\'', '\'\'') : null;
        const carpetas = turnoConPaciente ? t.paciente.carpetaEfectores.filter(x => String(x.organizacion._id) === String(a.organizacion._id)) : [];
        if (Array(carpetas).length > 0) {
            turno.HC = carpetas[0] ? (carpetas[0] as any).nroCarpeta : null;
        } else {
            turno.HC = null;
        }
        turno.codSexo = turnoConPaciente ? String(t.paciente.sexo) === 'femenino' ? String(2) : String(1) : null;
        turno.Sexo = turnoConPaciente ? t.paciente.sexo : null;
        turno.FechaNacimiento = (turnoConPaciente && t.paciente.fechaNacimiento && moment(t.paciente.fechaNacimiento).year() > 1900) ? moment(t.paciente.fechaNacimiento).format('YYYYMMDD') : '';
        const objectoEdad = (t.paciente && turno.FechaNacimiento) ? calcularEdad(t.paciente.fechaNacimiento) : null;

        turno.Edad = t.paciente && turno.fechaNacimiento ? objectoEdad.valor : null;
        turno.uniEdad = t.paciente && turno.fechaNacimiento ? objectoEdad.unidad : null;
        turno.CodRangoEdad = t.paciente && turno.fechaNacimiento ? objectoEdad.CodRangoEdad : null;
        turno.RangoEdad = t.paciente && turno.fechaNacimiento ? objectoEdad.RangoEdad : null;
        turno.Peso = null;
        turno.Talla = null;
        turno.TAS = null;
        turno.TAD = null;
        turno.IMC = null;
        turno.RCVG = null;
        turno.codifica = null;
        turno.Diag1CodigoOriginal = null;
        turno.Desc1DiagOriginal = null;
        turno.Diag1CodigoAuditado = null;
        turno.Desc1DiagAuditado = null;
        turno.conceptId1 = null;
        turno.semanticTag1 = null;

        turno.term1 = null;
        turno.Principal = 0;
        turno.Tipodeconsulta = null;
        turno.ConsC2 = null;

        // Estado turno
        let estadoAuditoria = null;
        if (t) {
            // console.log(t.estado);
            switch (t.estado) {
                case 'disponible':
                    estadoAuditoria = 'Disponible';
                    break;
                case 'suspendido':
                    estadoAuditoria = 'Suspendido';
                    break;
                case 'asignado':
                    if (t.asistencia) {
                        estadoAuditoria = 'Asistencia Verificada';
                    }
                    if (t.diagnostico.codificaciones.length > 0) {
                        if (!(t.diagnostico.codificaciones[0].codificacionAuditoria && t.diagnostico.codificaciones[0].codificacionAuditoria.codigo) && (t.diagnostico.codificaciones[0].codificacionProfesional)) {
                            estadoAuditoria = 'Registrado por Profesional';
                        }
                        if ((t.asistencia === 'noAsistio' || t.asistencia === 'sinDatos' || (t.diagnostico.codificaciones[0].codificacionAuditoria && t.diagnostico.codificaciones[0].codificacionAuditoria.codigo))) {
                            estadoAuditoria = 'Auditado';
                        }
                    }
                    break;
                default:
                    estadoAuditoria = null;
            }

        }

        turno.estadoTurnoAuditoria = estadoAuditoria;


        // Asistencia
        turno.asistencia = turnoConPaciente && t.asistencia ? t.asistencia : null;
        turno.reasignado = turnoConPaciente && t.reasignado && t.reasignado.siguiente ? 'SI' : 'NO';
        // Diagnóstico 1 ORIGINAL
        if (t.diagnostico.codificaciones.length > 0 && t.diagnostico.codificaciones[0] && t.diagnostico.codificaciones[0].primeraVez !== undefined) {
            turno.primeraVez1 = (t.diagnostico.codificaciones[0].primeraVez === true) ? 1 : 0;
        } else {
            turno.primeraVez1 = null;
        }
        if (t.diagnostico.codificaciones.length > 0 && t.diagnostico.codificaciones[0].codificacionProfesional) {
            turno.codifica = 'PROFESIONAL';
            if (t.diagnostico.codificaciones[0].codificacionProfesional.cie10 && t.diagnostico.codificaciones[0].codificacionProfesional.cie10.codigo) {
                turno.Diag1CodigoOriginal = t.diagnostico.codificaciones[0].codificacionProfesional.cie10.codigo;
                turno.Desc1DiagOriginal = t.diagnostico.codificaciones[0].codificacionProfesional.cie10.nombre;
            }
            if (t.diagnostico.codificaciones[0].codificacionProfesional.snomed && t.diagnostico.codificaciones[0].codificacionProfesional.snomed.conceptId) {
                turno.conceptId1 = t.diagnostico.codificaciones[0].codificacionProfesional.snomed.conceptId;
                turno.term1 = t.diagnostico.codificaciones[0].codificacionProfesional.snomed.term;
                turno.semanticTag1 = t.diagnostico.codificaciones[0].codificacionProfesional.snomed.semanticTag;
            }
        } else {
            turno.codifica = 'NO PROFESIONAL';
        }
        // Diagnóstico 1 AUDITADO
        if (t.diagnostico.codificaciones.length > 0 && t.diagnostico.codificaciones[0].codificacionAuditoria && t.diagnostico.codificaciones[0].codificacionAuditoria.codigo) {
            turno.Diag1CodigoAuditado = t.diagnostico.codificaciones[0].codificacionAuditoria.codigo;
            turno.Desc1DiagAuditado = t.diagnostico.codificaciones[0].codificacionAuditoria.nombre;
            turno.ConsC2 = t.diagnostico.codificaciones[0].codificacionAuditoria.c2 && t.diagnostico.codificaciones[0].primeraVez ? 'SI' : 'NO';
            turno.Tipodeconsulta = t.diagnostico.codificaciones[0].primeraVez ? 'Primera vez' : 'Ulterior';
            turno.Principal = 1;
        }

        // Diagnóstico 2 ORIGINAL
        turno.Diag2CodigoOriginal = null;
        turno.Desc2DiagOriginal = null;
        turno.Diag2CodigoAuditado = null;
        turno.Desc2DiagAuditado = null;
        turno.conceptId2 = null;
        turno.term2 = null;
        turno.semanticTag2 = null;
        if (t.diagnostico.codificaciones.length > 1 && t.diagnostico.codificaciones[1] && t.diagnostico.codificaciones[1].primeraVez !== undefined) {
            turno.primeraVez2 = (t.diagnostico.codificaciones[1].primeraVez === true) ? 1 : 0;
        } else {
            turno.primeraVez2 = null;
        }
        if (t.diagnostico.codificaciones.length > 1 && t.diagnostico.codificaciones[1].codificacionProfesional) {
            if (t.diagnostico.codificaciones[1].codificacionProfesional.cie10 && t.diagnostico.codificaciones[1].codificacionProfesional.cie10.codigo) {
                turno.Diag2CodigoOriginal = t.diagnostico.codificaciones[1].codificacionProfesional.cie10.codigo;
                turno.Desc2DiagOriginal = t.diagnostico.codificaciones[1].codificacionProfesional.cie10.nombre;
            }
            if (t.diagnostico.codificaciones[1].codificacionProfesional.snomed && t.diagnostico.codificaciones[1].codificacionProfesional.snomed.conceptId) {
                turno.conceptId2 = t.diagnostico.codificaciones[1].codificacionProfesional.snomed.conceptId;
                turno.term2 = t.diagnostico.codificaciones[1].codificacionProfesional.snomed.term;
                turno.semanticTag2 = t.diagnostico.codificaciones[1].codificacionProfesional.snomed.semanticTag;
            }
        }
        // Diagnóstico 2 AUDITADO
        if (t.diagnostico.codificaciones.length > 1 && t.diagnostico.codificaciones[1].codificacionAuditoria && t.diagnostico.codificaciones[1].codificacionAuditoria.codigo) {
            turno.Diag2CodigoAuditado = t.diagnostico.codificaciones[1].codificacionAuditoria.codigo;
            turno.Desc2DiagAuditado = t.diagnostico.codificaciones[1].codificacionAuditoria.nombre;
        }
        // Diagnóstico 3 ORIGINAL
        turno.Diag3CodigoOriginal = null;
        turno.Desc3DiagOriginal = null;
        turno.Diag3CodigoAuditado = null;
        turno.Desc3DiagAuditado = null;
        turno.conceptId3 = null;
        turno.term3 = null;
        turno.semanticTag3 = null;

        if (t.diagnostico.codificaciones.length > 2 && t.diagnostico.codificaciones[2] && t.diagnostico.codificaciones[2].primeraVez !== undefined) {
            turno.primeraVez3 = (t.diagnostico.codificaciones[2].primeraVez === true) ? 1 : 0;
        } else {
            turno.primeraVez3 = null;
        }
        if (t.diagnostico.codificaciones.length > 2 && t.diagnostico.codificaciones[2].codificacionProfesional) {
            if (t.diagnostico.codificaciones[2].codificacionProfesional.cie10 && t.diagnostico.codificaciones[2].codificacionProfesional.cie10.codigo) {
                turno.Diag3CodigoOriginal = t.diagnostico.codificaciones[2].codificacionProfesional.cie10.codigo;
                turno.Desc3DiagOriginal = t.diagnostico.codificaciones[2].codificacionProfesional.cie10.nombre;
            }
            if (t.diagnostico.codificaciones[2].codificacionProfesional.snomed && t.diagnostico.codificaciones[2].codificacionProfesional.snomed.conceptId) {
                turno.conceptId3 = t.diagnostico.codificaciones[2].codificacionProfesional.snomed.conceptId;
                turno.term3 = t.diagnostico.codificaciones[2].codificacionProfesional.snomed.term;
                turno.semanticTag3 = t.diagnostico.codificaciones[2].codificacionProfesional.snomed.semanticTag;
            }
        }
        // Diagnóstico 3 AUDITADO
        if (t.diagnostico.codificaciones.length > 2 && t.diagnostico.codificaciones[2].codificacionAuditoria && t.diagnostico.codificaciones[2].codificacionAuditoria.codigo) {
            turno.Diag3CodigoAuditado = t.diagnostico.codificaciones[2].codificacionAuditoria.codigo;
            turno.Desc3DiagAuditado = t.diagnostico.codificaciones[2].codificacionAuditoria.nombre;
        }

        turno.Profesional = (a.profesionales && a.profesionales[0] && a.profesionales.length > 0 ? a.profesionales.map(pr => String(pr.apellido) + ', ' + String(pr.nombre)).join('; ') : 'Sin profesionales');
        turno.Profesional = turno.Profesional.toString().replace('\'', '\'\'');
        turno.TipoProfesional = null;
        turno.CodigoEspecialidad = null;
        turno.Especialidad = null,
            // REVISAR ESTA PARTE ¿Tendría que mostrar todas? ¿o por algun criterio?
            // turno.Especialidad = profesionalesEspecialidades && profesionalesEspecialidades[0] ? profesionalesEspecialidades.especialidades[0].especialidad.nombre : 'Sin datos';
            turno.CodigoServicio = null;
        turno.Servicio = (a.espacioFisico && a.espacioFisico.servicio ? a.espacioFisico.servicio.nombre : 'Sin servicio');
        turno.IdBarrio = null;
        turno.Barrio = null;
        turno.IdLocalidad = null;
        turno.Localidad = null;
        turno.IdDpto = null;
        turno.Departamento = null;
        turno.IdPcia = null;
        turno.Provincia = null;
        turno.IdNacionalidad = null;
        turno.Nacionalidad = null;
        turno.Calle = null;
        turno.Altura = null;
        turno.Piso = null;
        turno.Depto = null;
        turno.Manzana = null;
        turno.ConsObst = t.tipoPrestacion && t.tipoPrestacion.term.includes('obstetricia') ? 'SI' : 'NO';
        turno.IdObraSocial = (turnoConPaciente && t.paciente.obraSocial && t.paciente.obraSocial.codigo) ? t.paciente.obraSocial.codigo : null;
        turno.ObraSocial = (turnoConPaciente && t.paciente.obraSocial && t.paciente.obraSocial.financiador) ? t.paciente.obraSocial.financiador.toString().replace('\'', '\'\'') : null;
        if (tipoEfector) {
            switch (tipoEfector) {
                case 'Centro de Salud':
                    turno.TipoEfector = '1';
                    break;
                case 'Hospital':
                    turno.TipoEfector = '2';
                    break;
                case 'Puesto Sanitario':
                    turno.TipoEfector = '3';
                    break;
                case 'ONG':
                    turno.TipoEfector = '6';
                    break;
            }

        } else {
            tipoEfector = '';
            turno.TipoEfector = '';
        }
        turno.DescTipoEfector = tipoEfector;
        turno.IdZona = null;
        turno.Zona = null;
        turno.SubZona = null;
        turno.idEfectorSuperior = null;
        turno.EfectorSuperior = null;
        turno.AreaPrograma = null;

        turno.IdPaciente = (t.paciente) ? String(t.paciente.id) : null;
        turno.Longitud = '';
        turno.Latitud = '';
        turno.telefono = t.paciente && t.paciente.telefono ? t.paciente.telefono : '';
        turno.estadoAgenda = a.estado;
        turno.turnosMobile = 0;
        if (t.emitidoPor && (t.emitidoPor === 'appMobile')) {
            turno.turnosMobile = 1;
        }

        // se verifica si existe el turno en sql
        let queryInsert = 'INSERT INTO ' + configPrivate.conSqlPecas.table.pecasTable +
            '(idEfector, Efector, TipoEfector, DescTipoEfector, IdZona, Zona, SubZona, idEfectorSuperior, EfectorSuperior, AreaPrograma, ' +
            'idAgenda, FechaAgenda, HoraAgenda, estadoAgenda, numeroBloque, turnosProgramados, turnosProfesional, turnosLlaves, turnosDelDia, ' +
            'idTurno, estadoTurno, tipoTurno, sobreturno, FechaConsulta, HoraTurno, Periodo, Tipodeconsulta, estadoTurnoAuditoria, Principal, ConsC2, ConsObst, tipoPrestacion, ' +
            'DNI, Apellido, Nombres, HC, CodSexo, Sexo, FechaNacimiento, Edad, UniEdad, CodRangoEdad, RangoEdad, IdObraSocial, ObraSocial, IdPaciente, telefono, ' +
            'IdBarrio, Barrio, IdLocalidad, Localidad, IdDpto, Departamento, IdPcia, Provincia, IdNacionalidad, Nacionalidad, ' +
            'Calle, Altura, Piso, Depto, Manzana, Longitud, Latitud, ' +
            'Peso, Talla, TAS, TAD, IMC, RCVG, asistencia, reasignado, ' +
            'Diag1CodigoOriginal, Desc1DiagOriginal, Diag1CodigoAuditado, Desc1DiagAuditado, SemanticTag1, SnomedConcept1, SnomedTerm1, primeraVez1, ' +
            'Diag2CodigoOriginal, Desc2DiagOriginal, Diag2CodigoAuditado, Desc2DiagAuditado, SemanticTag2, SnomedConcept2, SnomedTerm2, primeraVez2, ' +
            'Diag3CodigoOriginal, Desc3DiagOriginal, Diag3CodigoAuditado, Desc3DiagAuditado, SemanticTag3, SnomedConcept3, SnomedTerm3, primeraVez3, ' +
            'Profesional, TipoProfesional, CodigoEspecialidad, Especialidad, CodigoServicio, Servicio, ' +
            'codifica, turnosMobile, updated) ' +
            'VALUES  ( ' + turno.idEfector + ',\'' + turno.Organizacion + '\',\'' + turno.TipoEfector + '\',\'' + turno.DescTipoEfector +
            '\',' + turno.IdZona + ',\'' + turno.Zona + '\',\'' + turno.SubZona + '\',' + turno.idEfectorSuperior + ',\'' + turno.EfectorSuperior + '\',\'' + turno.AreaPrograma +
            '\',\'' + turno.idAgenda + '\',\'' + turno.FechaAgenda + '\',\'' + turno.HoraAgenda + '\',\'' + turno.estadoAgenda +
            '\',' + turno.numeroBloque + ',' + turno.accesoDirectoProgramado + ',' + turno.reservadoProfesional + ',' + turno.reservadoGestion + ',' + turno.accesoDirectoDelDia +
            ',\'' + turno.idTurno + '\',\'' + turno.estadoTurno + '\',\'' + turno.tipoTurno + '\',\'' + turno.sobreturno + '\',\'' + turno.FechaConsulta + '\',\'' + turno.HoraTurno + '\',' + turno.Periodo + ',\'' + turno.Tipodeconsulta + '\',\'' + turno.estadoTurnoAuditoria + '\',\'' + turno.Principal +
            '\',\'' + turno.ConsC2 + '\',\'' + turno.ConsObst + '\',\'' + turno.tipoPrestacion +
            // DATOS PACIENTE
            '\',' + turno.DNI + ',\'' + turno.Apellido + '\',\'' + turno.Nombres + '\',\'' + turno.HC + '\',\'' + turno.codSexo +
            '\',\'' + turno.Sexo + '\',\'' + turno.FechaNacimiento + '\',' + turno.Edad + ',\'' + turno.uniEdad + '\',\'' + turno.CodRangoEdad +
            '\',\'' + turno.RangoEdad + '\',' + turno.IdObraSocial + ',\'' + turno.ObraSocial + '\',\'' + turno.IdPaciente + '\',\'' + turno.telefono +
            '\',' + turno.IdBarrio + ',\'' + turno.Barrio + '\',' + turno.IdLocalidad +
            ',\'' + turno.Localidad + '\',' + turno.IdDpto + ',\'' + turno.Departamento + '\',' + turno.IdPcia + ',\'' + turno.Provincia +
            '\',' + turno.IdNacionalidad + ',\'' + turno.Nacionalidad + '\',\'' + turno.Calle + '\',\'' + turno.Altura + '\',\'' + turno.Piso +
            '\',\'' + turno.Depto + '\',\'' + turno.Manzana + '\',\'' + turno.Longitud + '\',\'' + turno.Latitud +
            '\',' + turno.Peso + ',' + turno.Talla + ',\'' + turno.TAS + '\',\'' + turno.TAD + '\',\'' + turno.IMC + '\',\'' + turno.RCVG +
            // DATOS CONSULTA
            '\',\'' + turno.asistencia + '\',\'' + turno.reasignado +
            '\',\'' + turno.Diag1CodigoOriginal + '\',\'' + turno.Desc1DiagOriginal + '\',\'' + turno.Diag1CodigoAuditado + '\',\'' + turno.Desc1DiagAuditado +
            '\',\'' + turno.semanticTag1 + '\',\'' + turno.conceptId1 + '\',\'' + turno.term1 + '\',' + turno.primeraVez1 +
            ',\'' + turno.Diag2CodigoOriginal + '\',\'' + turno.Desc2DiagOriginal + '\',\'' + turno.Diag2CodigoAuditado + '\',\'' + turno.Desc2DiagAuditado +
            '\',\'' + turno.semanticTag2 + '\',\'' + turno.conceptId2 + '\',\'' + turno.term2 + '\',' + turno.primeraVez2 +
            ',\'' + turno.Diag3CodigoOriginal + '\',\'' + turno.Desc3DiagOriginal + '\',\'' + turno.Diag3CodigoAuditado + '\',\'' + turno.Desc3DiagAuditado +
            '\',\'' + turno.semanticTag3 + '\',\'' + turno.conceptId3 + '\',\'' + turno.term3 + '\',' + turno.primeraVez3 +
            ',\'' + turno.Profesional + '\',\'' + turno.TipoProfesional + '\',' + turno.CodigoEspecialidad + ',\'' + turno.Especialidad +
            '\',' + turno.CodigoServicio + ',\'' + turno.Servicio + '\',\'' + turno.codifica + '\',' + turno.turnosMobile + ',\'' + moment().format('YYYYMMDD HH:mm') + '\') ';

        let fakeRequest = {
            user: {
                usuario: 'msPecas',
                app: 'integracion-pecas',
                organizacion: 'sss'
            },
            ip: 'localhost',
            connection: {
                localAddress: ''
            }
        };

        let rta = await existeTurnoPecas(turno.idTurno);
        if (rta.recordset.length > 0 && rta.recordset[0].idTurno) {
            const queryDel = await eliminaTurnoPecas(turno.idTurno);

            if (queryDel.rowsAffected[0] > 0) {
                await executeQuery(queryInsert);
            }
        } else {
            await executeQuery(queryInsert);
        }
    } catch (error) {
        return (error);
    }
}
async function existeTurnoPecas(turno: any) {
    const result = await new sql.Request(poolTurnos)
        .input('idTurno', sql.VarChar(50), turno)
        .query(`SELECT idTurno FROM ${configPrivate.conSqlPecas.table.pecasTable}  WHERE idTurno = @idTurno`);
    return result;
}
async function eliminaTurnoPecas(turno: any) {
    const result = await new sql.Request(poolTurnos)
        .input('idTurno', sql.VarChar(50), turno)
        .query(`DELETE FROM ${configPrivate.conSqlPecas.table.pecasTable} WHERE idTurno = @idTurno`);
    return result;
}
function calcularEdad(fechaNacimiento) {
    let edad: any;
    const fechaActual: Date = new Date();
    const fechaAct = moment(fechaActual, 'YYYY-MM-DD HH:mm:ss');
    const difDias = fechaAct.diff(fechaNacimiento, 'd'); // Diferencia en días
    const difAnios = Math.floor(difDias / 365.25);
    const difMeses = Math.floor(difDias / 30.4375);

    if (difAnios !== 0) {
        edad = {
            valor: difAnios,
            unidad: 'A'
        };
        if (difAnios <= 4) {
            edad['CodRangoEdad'] = '2';
            edad['RangoEdad'] = '[1 a 4]';
        } else if (difAnios >= 5 && difAnios <= 14) {
            edad['CodRangoEdad'] = '3';
            edad['RangoEdad'] = '[5 a 14]';
        } else if (difAnios >= 15 && difAnios <= 19) {
            edad['CodRangoEdad'] = '4';
            edad['RangoEdad'] = '[15 a 19]';
        } else if (difAnios >= 20 && difAnios <= 39) {
            edad['CodRangoEdad'] = '5';
            edad['RangoEdad'] = '[20 a 39]';
        } else if (difAnios >= 40 && difAnios <= 69) {
            edad['CodRangoEdad'] = '6';
            edad['RangoEdad'] = '[40 a 69]';
        } else if (difAnios >= 70) {
            edad['CodRangoEdad'] = '7';
            edad['RangoEdad'] = '[70 y +]';
        }
    } else if (difMeses !== 0) {
        edad = {
            valor: difMeses,
            unidad: 'M',
            CodRangoEdad: '1',
            RangoEdad: '[1]'
        };
    } else if (difDias !== 0) {
        edad = {
            valor: difDias,
            unidad: 'D',
            CodRangoEdad: '1',
            RangoEdad: '[1]'
        };
    }
    return edad;
}
async function profesionalEspecialidades(profesional) {
    // Devuelve un objeto profesional con sus especialidades
    let objProfesionalEspecialidades: any = null;
    const resultado: any = await getEspecialidades(profesional.id);
    if (resultado) {
        objProfesionalEspecialidades = {
            nombre: resultado.nombre,
            apellido: resultado.apellido,
            documento: resultado.documento,
            especialidades: resultado.formacionPosgrado
        };
    }
    return objProfesionalEspecialidades;
}

async function executeQuery(query: any) {
    let fakeRequest = {
        user: {
            usuario: 'msPecas',
            app: 'integracion-pecas',
            organizacion: 'sss'
        },
        ip: 'localhost',
        connection: {
            localAddress: ''
        }
    };
    try {
        query += ' select SCOPE_IDENTITY() as id';
        const result = await new sql.Request(poolTurnos).query(query);
        if (result && result.recordset) {
            return result.recordset[0].id;
        }
    } catch (err) {
        await log(fakeRequest, 'microservices:integration:pecas', undefined, query, err);
        return err;
    }
}

