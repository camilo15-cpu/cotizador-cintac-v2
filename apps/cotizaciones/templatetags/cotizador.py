from django import template

from apps.cotizaciones.services import a_clp as _a_clp

register = template.Library()


@register.filter
def a_clp(monto_usd, tipo_cambio):
    """{{ monto_usd|a_clp:tipo_cambio }} -> monto en CLP (entero)."""
    try:
        return _a_clp(monto_usd, tipo_cambio)
    except Exception:
        return ''
