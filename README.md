# KixApp
Uma aplicação de kixikila digital.

## Frontend React

A nova interface de autenticação e o painel inicial ficam em `client/`. O
`index.html` original continua preservado como referência da aplicação anterior.
Esta fase não cria, elimina nem altera objetos no Supabase.

### Executar

```sh
npm run dev
```

O frontend usa o projeto Supabase que já estava configurado no app importado.
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` podem substituir os valores
públicos existentes sem alterar a base de dados.

### Verificar

```sh
npm run check
npm run build
```
