
import * as mongoose from 'mongoose';

export let pacienteFederadoSchema = new mongoose.Schema({
    id: mongoose.Schema.Types.ObjectId,
    idPaciente: mongoose.Schema.Types.ObjectId,
    respuesta: String,
    body: {
        resourceType: String,
        issue: [
            {
                severity: String,
                code: String,
                diagnostics: String
            }
        ]

    }
});

export let pacienteFederado = mongoose.model('pacienteFederado', pacienteFederadoSchema, 'pacienteFederado');