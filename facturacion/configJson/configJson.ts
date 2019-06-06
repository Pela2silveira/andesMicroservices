import * as moment from 'moment';
import { facturaSumar, validaDatosReportables } from './../facturar/sumar/factura-sumar';
import { facturaRecupero } from './../facturar/recupero-financiero/factura-recupero';

import { QuerySumar } from './../facturar/sumar/query-sumar';

import { IDtoFacturacion } from './../interfaces/IDtoFacturacion';
import { IDtoSumar } from '../interfaces/IDtoSumar';
import { IDtoRecupero } from '../interfaces/IDtoRecupero';

/**
 *
 *
 * @export
 * @param {*} pool
 * @param {IDtoFacturacion} dtoFacturacion
 * @param {*} datosConfiguracionAutomatica
 */
export async function jsonFacturacion(pool, dtoFacturacion: IDtoFacturacion) {
    let querySumar = new QuerySumar();
    let afiliadoSumar: any = await querySumar.getAfiliadoSumar(pool, dtoFacturacion.paciente.dni);
    let datoReportable = [];

    let facturacion = {
        /* Prestación Odontología */
        /* TODO: poner la expresión que corresponda */
        /* %%%%%%%%% Está en desarrollo todavía  %%%%%%%%%%%%%%%%%%%%% */
        34043003: {
            term: 'consulta de odontologia',
            sumar: (arrayPrestacion, arrayConfiguracion) => {

                let dr = {
                    idDatoReportable: '',
                    datoReportable: ''
                };

                arrayPrestacion = arrayPrestacion.filter(obj => obj !== null);
                arrayConfiguracion = arrayConfiguracion.map((dr: any) => dr[0]);

                // let caries = arrayPrestacion.find(obj => console.log("Primero: ", obj.conceptId) === console.log("Segundo: ", arrayConfiguracion[0].conceptId));

                let caries2 = arrayConfiguracion.find(obj => obj.conceptId === arrayPrestacion.conceptId);

            }
        },

        /* Prestación Otoemisiones */
        /* TODO: poner la expresión que corresponda */
        otoemisiones: {
            term: 'otoemisiones',
            sumar: (arrayPrestacion, arrayConfiguracion) => {
                if (arrayPrestacion) {
                    let dr = {
                        idDatoReportable: '',
                        datoReportable: ''
                    };

                    arrayPrestacion = arrayPrestacion.filter((obj: any) => obj !== null).map((obj: any) => obj);
                    arrayConfiguracion = arrayConfiguracion.map((ac: any) => ac[0]);
                    let flagDatosReportables = true;

                    arrayPrestacion.forEach((element, index) => {
                        let oido = arrayConfiguracion.find((obj: any) => obj.conceptId === element.conceptId);

                        if (oido) {
                            let valor = arrayConfiguracion.find((obj: any) => obj.conceptId === element.valor.conceptId);
                            if (valor) {
                                dr.datoReportable += oido.valor + valor.valor + '/';
                            } else {
                                flagDatosReportables = false;
                            }
                        }
                    });
                    if (flagDatosReportables) {
                        dr.idDatoReportable = dtoFacturacion.configAutomatica.sumar.datosReportables[0].idDatosReportables;
                        dr.datoReportable = dr.datoReportable.slice(0, -1);

                        datoReportable.push(dr);
                        return datoReportable;
                    } else {
                        return null;
                    }
                } else {
                    return null;
                }
            }
        },

        /* Prestación Niño Sano 410621008*/
        /* TODO: poner la expresión que corresponda */
        niño_sano: {
            term: 'niño sano',
            sumar: async (arrayPrestacion, arrayConfiguracion) => {
                if ((arrayPrestacion) && (arrayPrestacion.length > 0)) {
                    arrayPrestacion = arrayPrestacion.filter((obj: any) => obj !== null).map((obj: any) => obj);

                    arrayPrestacion.forEach((element: any) => {
                        let dr = {
                            idDatoReportable: '',
                            datoReportable: ''
                        };
                        dr.idDatoReportable = element.idDatoReportable;
                        dr.datoReportable = element.valor;

                        datoReportable.push(dr);
                    });

                    return datoReportable;
                } else {
                    return null;
                }
            },
        },
        main: async (prestacion: any, tipoFacturacion: String) => {
            if (tipoFacturacion === 'recupero') {
                let dto: any = {
                    factura: 'recupero'
                };

                return dto;
            } else if (tipoFacturacion === 'sumar') {
                const arrayPrestacion = (prestacion.prestacion.datosReportables !== null) ? prestacion.prestacion.datosReportables.map((dr: any) => dr).filter((value) => value !== undefined) : null;
                const arrayConfiguracion = (dtoFacturacion.configAutomatica) ? dtoFacturacion.configAutomatica.sumar.datosReportables.map((config: any) => config.valores) : null;

                if (arrayConfiguracion) {
                    let dto: any = {
                        factura: 'sumar',
                        diagnostico: dtoFacturacion.configAutomatica.sumar.diagnostico[0].diagnostico,
                        datosReportables: await facturacion[dtoFacturacion.configAutomatica.sumar.key_datosreportables].sumar(arrayPrestacion, arrayConfiguracion)
                    };
                    return dto;
                } else {
                    return null
                }
            }
        },
        sumar: {
            preCondicionSumar: (dtoFacturacion: IDtoFacturacion) => {
                let valido = false;
                let esAfiliado = (afiliadoSumar) ? true : false;

                let niñoSano = true; /* Se valida que si la prestación es niño sano se pueda facturar si fue validada por un médico*/
                if ((dtoFacturacion.configAutomatica) && (dtoFacturacion.configAutomatica.sumar.key_datosreportables === 'niño_sano')) {
                    if (dtoFacturacion.profesional.formacionGrado !== 'medico') {
                        niñoSano = false;
                    }
                }

                // let datosReportables = (dtoFacturacion.prestacion.datosReportables) ? true : false;//validaDatosReportables(dtoFacturacion, datosConfiguracionAutomatica);

                /* TODO: validar que los DR obligatorios vengan desde RUP. A veces no se completan todos y esa
                prestación no se debería poder facturar */
                let conditionsArray = [
                    esAfiliado,
                    niñoSano
                    // datosReportables
                ];

                if (conditionsArray.indexOf(false) === -1) {
                    valido = true;
                }

                return valido;
            }
        }
    };

    let dtoSumar: IDtoSumar;
    let dtoRecupero: IDtoRecupero;
    let tipoFacturacion: String = '';
    if (dtoFacturacion.obraSocial.financiador !== 'SUMAR') {
        /* Paciente tiene OS Se factura por Recupero */
        /* TODO: Verificar si hay precondición para facturar por Recupero*/
        let os = (dtoFacturacion.obraSocial.prepaga) ? dtoFacturacion.obraSocial.idObraSocial : dtoFacturacion.obraSocial.codigoPuco;

        dtoRecupero = {
            objectId: dtoFacturacion.turno._id,
            idTipoNomenclador: dtoFacturacion.configAutomatica.recuperoFinanciero.idTipoNomenclador,
            codigo: dtoFacturacion.configAutomatica.recuperoFinanciero.codigo,
            idServicio: dtoFacturacion.configAutomatica.recuperoFinanciero.idServicio,
            dniPaciente: dtoFacturacion.paciente.dni,
            dniProfesional: dtoFacturacion.profesional.dni,
            codigoFinanciador: os,
            idEfector: dtoFacturacion.organizacion.idSips,
            motivoDeConsulta: dtoFacturacion.motivoConsulta,
            prepaga: dtoFacturacion.obraSocial.prepaga,
        };
        await facturaRecupero(pool, dtoRecupero);
    } else {
        /* Paciente NO TIENE OS se factura por Sumar */
        if (facturacion['sumar'].preCondicionSumar(dtoFacturacion)) {
            tipoFacturacion = 'sumar';

            let main = await facturacion.main(dtoFacturacion, tipoFacturacion);

            dtoSumar = {
                idPrestacion: dtoFacturacion.idPrestacion,
                idNomenclador: (dtoFacturacion.configAutomatica) ? dtoFacturacion.configAutomatica.sumar.idNomenclador : null,
                fechaTurno: dtoFacturacion.turno.fechaTurno,
                objectId: dtoFacturacion.turno._id,
                cuie: dtoFacturacion.organizacion.cuie,
                diagnostico: (main) ? main.diagnostico : null,
                dniPaciente: dtoFacturacion.paciente.dni,
                profesional: dtoFacturacion.profesional,
                claveBeneficiario: afiliadoSumar.clavebeneficiario,
                idAfiliado: afiliadoSumar.id_smiafiliados,
                edad: moment(new Date()).diff(dtoFacturacion.paciente.fechaNacimiento, 'years'),
                sexo: (dtoFacturacion.paciente.sexo === 'masculino') ? 'M' : 'F',
                fechaNacimiento: dtoFacturacion.paciente.fechaNacimiento,
                anio: moment(dtoFacturacion.paciente.fechaNacimiento).format('YYYY'),
                mes: moment(dtoFacturacion.paciente.fechaNacimiento).format('MM'),
                dia: moment(dtoFacturacion.paciente.fechaNacimiento).format('DD'),
                datosReportables: (main) ? main.datosReportables : null
            };
            await facturaSumar(pool, dtoSumar);
        }
    }
}
