import { Microservice } from '@andes/bootstrap';
import * as ejecutaCDA from './controller/ejecutaCDA';
import * as efectores from './constantes';

let pkg = require('./package.json');
let ms = new Microservice(pkg);
const router = ms.router();

router.group('/cda', (group) => {
    // group.use(Middleware.authenticate());
    group.post('/ejecutar', async (req: any, res) => {
        res.send({ message: 'ok' });

        let paciente = req.body.paciente;
        let listaEfectores: any = Object.keys(efectores);

        for (let i = 0; i < listaEfectores.length; i++) {
            ejecutaCDA.ejecutar(listaEfectores[i], paciente);
        }
    });
});

ms.add(router);
ms.start();
