function calcularEdad(fechaNacimiento: any) {
  const age = fechaNacimiento.split("/");
  const hoy = new Date();

  let edad = hoy.getFullYear() - Number(age[0]);
  const mes = hoy.getMonth() - Number(age[1]);
  const dia = hoy.getDate() - Number(age[2]);

  // Ajusta la edad si el cumpleaños aún no ha pasado este año
  if (mes < 0 || (mes === 0 && dia < 0)) {
    edad--;
  }

  return edad;
}

export default calcularEdad;
