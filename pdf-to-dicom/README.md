# pdf-to-dicom
 
Microservicio para transformar un archivo pdf y metadata en un DICOM. Utiliza el método pdf2dcm de la librería DCMTK(https://github.com/DCMTK/dcmtk) a través del contenedor darthunix/dcmtk. Luego lo sirve por http en una pequeña aplicacion Go. Este tipo de funcionalidad es particularment util para transformar cualquier archivo en formato PDF y almacenarlo en un Servidor PACS a través del método DICOM STOW-RS.

### Desarrollo

```bash
docker build --tag http-pdf2dcm .
docker run --rm -p 8080:8080 -i -t http-pdf2dcm
```

### Usage

```bash
docker run --rm -p 8080:8080 -i -t andesnqn/pdf2dcm
```

Ejemplo con cUrl:

```bash
curl --location --request POST 'http://localhost:8080/pdf-to-dicom' \
--form 'file=@/home/mbotta/Descargas/consulta-de-enfermeria-29-09-2020-110132.pdf' \
--form 'documento=34934522'
```
