const destination = new URL('./notas/', document.currentScript.src)
destination.search = window.location.search
destination.hash = window.location.hash
window.location.replace(destination.href)
