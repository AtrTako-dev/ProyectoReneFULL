from dataclasses import dataclass, field


class ErrorDominio(Exception):
    """Error controlado de la capa de datos o de dominio."""


@dataclass(frozen=True)
class ErrorFila:
    archivo: str
    fila: int | None
    campo: str
    motivo: str


class ErrorValidacionArchivo(ErrorDominio):
    def __init__(self, archivo: str, errores: list[ErrorFila]):
        self.archivo = archivo
        self.errores = errores
        detalle = "; ".join(
            f"fila {error.fila or '-'} campo {error.campo}: {error.motivo}"
            for error in errores
        )
        super().__init__(f"Archivo {archivo} rechazado: {detalle}")


class ConflictoImportacion(ErrorDominio):
    def __init__(self, conjunto: str, motivo: str):
        self.conjunto = conjunto
        self.motivo = motivo
        super().__init__(f"Conflicto al importar {conjunto}: {motivo}")


class ConflictoUsuario(ErrorDominio):
    pass


class NoEncontrado(ErrorDominio):
    pass


class RegistroInvalido(ErrorDominio):
    def __init__(self, entidad: str, identificador: object, motivos: list[str]):
        self.entidad = entidad
        self.identificador = identificador
        self.motivos = motivos
        super().__init__(f"Registro invalido de {entidad} {identificador}: {'; '.join(motivos)}")


class PermisoDenegado(ErrorDominio):
    pass


class OperacionNoPermitida(ErrorDominio):
    pass


@dataclass
class ResultadoImportacion:
    archivo: str
    conjunto: str
    estado: str
    ventas_insertadas: int
    ventas_existentes: int = 0
    importacion_id: int | None = None
    errores: list[ErrorFila] = field(default_factory=list)
