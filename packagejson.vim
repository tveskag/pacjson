call ale#linter#Define('json', {
\   'name': 'packagejson',
\   'executable': 'pacjson',
\   'output_stream': 'stdout',
\   'command': 'pacjson %s',
\   'callback': 'ale#handlers#unix#HandleAsError',
\})
