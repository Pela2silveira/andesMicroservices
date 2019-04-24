import * as sql from 'mssql';
import { QueryRecupero } from './query-recupero';
import { IDtoRecupero } from './../../interfaces/IDtoRecupero';

let queryRecupero = new QueryRecupero()

/**
 *
 *
 * @export
 * @param {*} pool
 * @param {IDtoRecupero} dtoRecupero
 * @param {*} datosConfiguracionAutomatica
 */
export async function facturaRecupero(pool, dtoRecupero: IDtoRecupero, datosConfiguracionAutomatica) {
    let existeOrden = await validaOrden(pool, dtoRecupero);

    if (!existeOrden) {
        const transaction = new sql.Transaction(pool);
        transaction.begin( async err => {
            try  {
                if (err) {
                    // handle error........s
                } else {
                    let nomencladorRecupero: any = await queryRecupero.getNomencladorRecupero(pool, datosConfiguracionAutomatica.recuperoFinanciero);

                    let dtoOrden = {
                        idEfector: dtoRecupero.idEfector,
                        /* Existe un trigger en Fac_Orden [Trigger_NumeroOrden] que actualiza 'numero' cuando el param es -1 */
                        numero: -1,
                        periodo: '0000/00',
                        idServicio: datosConfiguracionAutomatica.recuperoFinanciero.idServicio,
                        idPaciente: await queryRecupero.getIdPacienteSips(pool, dtoRecupero.dniPaciente),
                        idProfesional: await queryRecupero.getIdProfesionalSips(pool, dtoRecupero.dniProfesional),
                        fecha: new Date(),
                        fechaPractica: new Date(),
                        idTipoPractica: nomencladorRecupero.idTipoPractica,
                        idObraSocial: await queryRecupero.getIdObraSocialSips(pool, dtoRecupero.codigoFinanciador),
                        idUsuarioRegistro: 1,
                        fechaRegistro: new Date(),
                        idPrefactura: 0,
                        idFactura: 0,
                        baja: 0,
                        monto: nomencladorRecupero.valorUnidad,
                        objectId: dtoRecupero.objectId,
                        factAutomatica: 'prestacion'
                    };

                    const newIdOrden = await queryRecupero.saveOrdenRecupero(transaction, dtoOrden);

                    let dtoOrdendetalle = {
                        idOrden: newIdOrden,
                        idEfector: dtoRecupero.idEfector,
                        idNomenclador: nomencladorRecupero.idNomenclador,
                        descripcion: nomencladorRecupero.descripcion,
                        cantidad: 1,
                        valorUnidad: nomencladorRecupero.valorUnidad,
                        ajuste: 0,
                        totoal: nomencladorRecupero.valorUnidad
                    };

                    queryRecupero.saveOrdenDetalle(transaction, dtoOrdendetalle);

                    transaction.commit(err => {
                        // ... error checks
                    });
                }
            } catch {
                transaction.rollback(err => {
                    // ... error checks
                });
            }
        });
    }
}

/* Valida si la orden de prestación ya fue creada en la BD de Recupero Finanicero */
async function validaOrden(pool: any, dtoRecupero: IDtoRecupero): Promise<boolean> {
    let existe = false;

    let orden = await queryRecupero.getOrdenDePrestacion(pool, dtoRecupero);

    if (orden > 0) {
        existe = true;
    }

    return existe;
}
