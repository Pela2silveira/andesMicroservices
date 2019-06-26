import { Microservice } from '@andes/bootstrap';
import { recuperaDatos, recuperaDatosProf } from './controller/recuperaDatos';

import { postLogin } from './service/login';
let pkg = require('./package.json');
let ms = new Microservice(pkg);
const router = ms.router();

router.group('/mobile', (group) => {
    group.get('/migrar', async (_req: any, res) => {
        let lista = [];
        let listaProf = [];
        let usuario = _req.query.usuario;
        let login;
        try {
            login = usuario ? await postLogin(usuario) : null;
            if (login && login.estado >= 200 && login.estado < 300) {
                // migrar datos
                const registros = await recuperaDatos();
                const registrosProf = await recuperaDatosProf();
                if (registros.length > 0) {
                    registros.map(async registro => {
                        lista = lista.concat(registro);
                    });
                }
                if (registrosProf.length > 0) {
                    registrosProf.map(async registroProf => {
                        listaProf = listaProf.concat(registroProf);
                    });
                }
            }
            // devuelve un arreglo vacio en caso que no realizar la migración de datos
            res.json({ lista, listaProf });
        } catch (ex) {
            return ex;
        }


    });
});

ms.add(router);
ms.start();
