/* Läuft synchron im <head>: markiert JS-Verfügbarkeit, bevor gerendert wird (verhindert Flackern). */
document.documentElement.classList.replace('no-js', 'js');
