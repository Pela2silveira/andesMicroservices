import * as sql from 'mssql';
import { IDtoRecupero } from '../../interfaces/IDtoRecupero';

export class QueryRecupero {

    async getIdPacienteSips(pool: any, dni: any) {
        return new Promise((resolve: any, reject: any) => {
            (async () => {
                try {
                    let query = 'SELECT TOP 1 idPaciente FROM dbo.Sys_Paciente where activo = 1 and numeroDocumento = @dni order by objectId DESC;';
                    let resultado = await new sql.Request(pool)
                        .input('dni', sql.VarChar(50), dni)
                        .query(query);

                    if (resultado && resultado.recordset[0]) {
                        resolve(resultado.recordset[0] ? resultado.recordset[0].idPaciente : null);
                    }
                } catch (err) {
                    reject(err);
                }
            })();
        });
    }

    async getIdProfesionalSips(pool: any, dni: any) {
        return new Promise((resolve: any, reject: any) => {
            (async () => {
                try {
                    let query = 'SELECT idProfesional FROM dbo.Sys_Profesional WHERE activo = 1 and numeroDocumento = @dni';
                    let resultado = await new sql.Request(pool)
                        .input('dni', sql.VarChar(50), dni)
                        .query(query);

                    if (resultado && resultado.recordset[0]) {
                        resolve(resultado.recordset[0] ? resultado.recordset[0].idProfesional : null);
                    }

                } catch (err) {
                    reject(err);
                }
            })();
        });
    }


    async getNomencladorRecupero(pool: any, nomencladorRF: any) {
        return new Promise((resolve: any, reject: any) => {
            (async () => {
                try {
                    let query = 'SELECT idNomenclador, idTipoPractica, valorUnidad, descripcion FROM dbo.FAC_Nomenclador WHERE codigo = @codigo and idTipoNomenclador = @idTipoNomenclador';
                    let resultado = await new sql.Request(pool)
                        .input('codigo', sql.VarChar(50), nomencladorRF.codigo)
                        .input('idTipoNomenclador', sql.Int, nomencladorRF.idTipoNomenclador)
                        .query(query);

                    if (resultado && resultado.recordset[0]) {
                        resolve(resultado.recordset[0] ? resultado.recordset[0] : null);
                    }
                } catch (err) {
                    reject(err);
                }
            })();
        });
    }

    async getIdObraSocialSips(pool: any, codigoObraSocial: any) {
        return new Promise((resolve: any, reject: any) => {
            (async () => {
                try {
                    let query = 'SELECT idObraSocial FROM dbo.Sys_ObraSocial WHERE cod_PUCO = @codigo;';
                    let result = await new sql.Request(pool)
                        .input('codigo', sql.Int, codigoObraSocial)
                        .query(query);

                    if (result && result.recordset[0]) {
                        resolve(result.recordset[0] ? result.recordset[0].idObraSocial : 0);
                    }
                } catch (err) {
                    reject(err);
                }
            })();
        });
    }

    async getOrdenDePrestacion(pool: any, dtoRecupero: IDtoRecupero) {
        return new Promise((resolve: any, reject: any) => {
            (async () => {
                try {
                    let query = 'SELECT TOP 1 * FROM dbo.FAC_Orden WHERE objectId = @objectId';
                    let result = await new sql.Request(pool)
                        .input('objectId', sql.VarChar(100), dtoRecupero.objectId)
                        .query(query);
                    if (result && result.recordset[0]) {
                        resolve(1);
                    } else {
                        resolve(0);
                    }
                } catch (err) {
                    reject(err);
                }
            })();
        });

    }

    /**
     *
     *
     * @param {*} transaction
     * @param {*} dtoOrden
     * @returns
     * @memberof QueryRecupero
     */
    async saveOrdenRecupero(transaction: any, dtoOrden: any) {
        let query = 'INSERT INTO [dbo].[FAC_Orden]' +
            ' ([idEfector]' +
            ' ,[numero]' +
            ' ,[periodo]' +
            ' ,[idServicio]' +
            ' ,[idPaciente]' +
            ' ,[idProfesional]' +
            ' ,[fecha]' +
            ' ,[fechaPractica]' +
            ' ,[idTipoPractica]' +
            ' ,[idObraSocial]' +
            ' ,[idUsuarioRegistro]' +
            ' ,[fechaRegistro]' +
            ' ,[idPrefactura]' +
            ' ,[idFactura]' +
            ' ,[baja]' +
            ' ,[monto]' +
            ' ,[objectId] ' +
            ' ,[factAutomatico])' +
            ' VALUES' +
            ' (@idEfector' +
            ' ,@numero' +
            ' ,@periodo' +
            ' ,@idServicio' +
            ' ,@idPaciente' +
            ' ,@idProfesional' +
            ' ,@fecha' +
            ' ,@fechaPractica' +
            ' ,@idTipoPractica' +
            ' ,@idObraSocial' +
            ' ,@idUsuarioRegistro' +
            ' ,@fechaRegistro' +
            ' ,@idPrefactura' +
            ' ,@idFactura' +
            ' ,@baja' +
            ' ,@monto' +
            ' ,@objectId ' +
            ' ,@factAutomatico) ' +
            'DECLARE @numeroOrden Int =  SCOPE_IDENTITY() ' +
            'SELECT @numeroOrden as ID';

        const result = await new sql.Request(transaction)
            .input('idEfector', sql.Int, dtoOrden.idEfector)
            .input('numero', sql.Int, dtoOrden.numero)
            .input('periodo', sql.Char(10), dtoOrden.periodo)
            .input('idServicio', sql.Int, dtoOrden.idServicio)
            .input('idPaciente', sql.Int, dtoOrden.idPaciente)
            .input('idProfesional', sql.Int, dtoOrden.idProfesional)
            .input('fecha', sql.DateTime, new Date(dtoOrden.fecha))
            .input('fechaPractica', sql.DateTime, new Date(dtoOrden.fechaPractica))
            .input('idTipoPractica', sql.Int, dtoOrden.idTipoPractica)
            .input('idObraSocial', sql.Int, dtoOrden.idObraSocial)
            .input('idUsuarioRegistro', sql.Int, dtoOrden.idUsuarioRegistro)
            .input('fechaRegistro', sql.DateTime, new Date(dtoOrden.fechaRegistro))
            .input('idPrefactura', sql.Int, dtoOrden.idPrefactura)
            .input('idFactura', sql.Int, dtoOrden.idFactura)
            .input('baja', sql.Bit, dtoOrden.baja)
            .input('monto', sql.Decimal(18, 2), dtoOrden.monto)
            .input('objectId', sql.VarChar(50), dtoOrden.objectId)
            .input('factAutomatico', sql.VarChar(50), dtoOrden.factAutomatica)
            .query(query, (err: any) => {
                if (err) {
                    throw (err);
                }
            });
        return result.recordset[0] ? result.recordset[0].ID : null;
    }

    /**
     *
     *
     * @param {*} transaction
     * @param {*} ordenDetalle
     * @returns
     * @memberof QueryRecupero
     */
    async saveOrdenDetalle(transaction: any, ordenDetalle: any) {
        let query = 'INSERT INTO [dbo].[FAC_OrdenDetalle]' +
            ' ([idOrden]' +
            ' ,[idEfector]' +
            ' ,[idNomenclador]' +
            ' ,[descripcion]' +
            ' ,[cantidad]' +
            ' ,[valorUnidad]' +
            ' ,[ajuste])' +
            ' VALUES' +
            ' (@idOrden' +
            ' ,@idEfector' +
            ' ,@idNomenclador' +
            ' ,@descripcion' +
            ' ,@cantidad' +
            ' ,@valorUnidad' +
            ' ,@ajuste) ' +
            'SELECT SCOPE_IDENTITY() as ID';

        const result = await new sql.Request(transaction)
            .input('idOrden', sql.Int, ordenDetalle.idOrden)
            .input('idEfector', sql.Int, ordenDetalle.idEfector)
            .input('idNomenclador', sql.Int, ordenDetalle.idNomenclador)
            .input('descripcion', sql.VarChar(500), ordenDetalle.descripcion)
            .input('cantidad', sql.Int, ordenDetalle.cantidad)
            .input('valorUnidad', sql.Decimal(18, 2), ordenDetalle.valorUnidad)
            .input('ajuste', sql.Decimal(18, 2), ordenDetalle.ajuste)
            .query(query, (err: any, result: any) => {
                if (err) {
                    throw err;
                }
            });

        return result.recordset[0];
    }
}

