import * as sql from 'mssql';
import { QuerySumar } from './query-sumar';
import { IDtoFacturacion } from './../../interfaces/IDtoFacturacion';
import { IDtoSumar } from './../../interfaces/IDtoSumar';
import moment = require('moment');

let querySumar = new QuerySumar()

/**
 *
 *
 * @export
 * @param {*} pool
 * @param {IDtoSumar} dtoSumar
 * @param {*} datosConfiguracionAutomatica
 */
export async function facturaSumar(pool: any, dtoSumar: IDtoSumar, datosConfiguracionAutomatica) {
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = await new sql.Request(transaction);

        let dtoComprobante = {
            cuie: dtoSumar.cuie,
            fechaComprobante: new Date(),
            claveBeneficiario: dtoSumar.claveBeneficiario,
            idAfiliado: dtoSumar.idAfiliado,
            fechaCarga: new Date(),
            comentario: 'Carga Automática',
            periodo: moment(new Date, 'YYYY/MM/DD').format('YYYY') + '/' + moment(new Date, 'YYYY/MM/DD').format('MM'),
            activo: 'S',
            idTipoPrestacion: 1,
            objectId: dtoSumar.objectId
        };

        let newIdComprobante = await querySumar.saveComprobanteSumar(request, dtoComprobante);

        let precioPrestacion: any = await querySumar.getNomencladorSumar(pool, datosConfiguracionAutomatica.sumar.idNomenclador)

        let prestacion = {
            idComprobante: newIdComprobante,
            idNomenclador: datosConfiguracionAutomatica.sumar.idNomenclador,
            cantidad: 1,
            precioPrestacion: precioPrestacion.precio,
            idAnexo: 301,
            peso: 0,
            tensionArterial: '00/00',
            diagnostico: dtoSumar.diagnostico,
            edad: dtoSumar.edad,
            sexo: dtoSumar.sexo,
            fechaNacimiento: dtoSumar.fechaNacimiento,
            fechaPrestacion: new Date(),
            anio: dtoSumar.anio,
            mes: dtoSumar.mes,
            dia: dtoSumar.dia,
        }

        let idPrestacion = await querySumar.savePrestacionSumar(request, prestacion);

        for (let x = 0; x < dtoSumar.datosReportables.length; x++) {
            let datosReportables = {
                idPrestacion: idPrestacion,
                idDatoReportable: dtoSumar.datosReportables[x].idDatoReportable,
                valor: dtoSumar.datosReportables[x].datoReportable
            }

            let idDatoReportable = await querySumar.saveDatosReportablesSumar(request, datosReportables);
        }

        transaction.commit();
    } catch (e) {
        // log error
        console.log(e);
        transaction.rollback();
    }
}

export async function saveBeneficiario() {

}

/* Valida quelos datos reportables cargados en RUP sean los mismos que están en la colección configFacturacionAutomatica */
/* Falta Terminar */
export function validaDatosReportables(dtoFacturacion: IDtoFacturacion, datosConfigAutomatica) {
    /* TODO: configurar en configFacturacion si el dato reportable puede venir null o no */

    let drPrestacion = dtoFacturacion.prestacion.datosReportables.map(obj => obj[0]);
    let drConfigAutomatica = datosConfigAutomatica.sumar.datosReportables.map(obj => obj);

    let found = false;
    for (let i = 0; i < drPrestacion.length; i++) {
        if (drConfigAutomatica[i].valores[0].conceptId.indexOf(drPrestacion[i].registro.concepto.conceptId) > -1) {
            found = true;
        } else {
            found = false;
            break
        }
    }
}
