## Next Routes Middleware

[![npm version](https://d25lcipzij17d.cloudfront.net/badge.svg?id=js&type=6&v=1.4.2&x2=0)](https://www.npmjs.com/package/next-routes-middleware)

Extensible, customizable Next.JS routes middleware

## Installation

```
npm i --save next-routes-middleware
```

## Usage

Step 1: Create your own `now.dev.json`:

```json
{
  "patterns": {
    "first": "(?<first>.*)",
    "uuid": "(?<uuid>[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}){1}",
    "slug":"(?<slug>[^/]*)",
    "year":"(?<year>[0-9]{4})",
    "month":"(?<month>[0-9]{2})",
    "day":"(?<day>[0-9]{2})"
  },
  "routes": [
    { 
      "src": "/w/${first}", 
      "dest": "/work?slug=${first}" 
    },
    { 
      "src": "/resource/${uuid}", 
      "dest": "/complex?id=${uuid}" 
    },
    { 
      "src": "/t/${slug}/${year}-${month}-${day}", 
      "dest": "/more_complex?day=${day}&month=${month}&year=${year}&slug=${slug}" 
    },
    { "src": "/", "dest": "/index" }
  ]
}
```

Step 2: Using `next-routes-middleware` in your custom `server.js`

```js
const express = require('express')
const next = require('next');
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const routesMiddleware = require('next-routes-middleware')
const port = parseInt(process.env.PORT, 10) || 3000

app.prepare().then(() => {
  const server = express()
  routesMiddleware({server, app})
  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${port}`)
  })
})

```

## Customization and Overriding Routes

Suppose you want to do something else beyond rendering, you can provide custom routes handler like this

`customRoutes.js`
```js

function customRoutes(nextRoutes) {
  return {
    '/service-worker.js': function({app, req, res, join, dev}) {
      const filePath = dev ? join(__dirname, '../static', 'service-worker.dev.js'): join(__dirname, '../static', 'service-worker.js')
      app.serveStatic(req, res, filePath)
    },
    '/favicon.ico': function({app, req, res, join}) {
      const filePath = join(__dirname, '../static', 'favicon.ico')
      app.serveStatic(req, res, filePath)
    },
    '/static/wasm/*': function({app, req, res, next, handle, pathname}) {
      res.setHeader('Content-Type', 'application/wasm')
      handle(req, res, parsedUrl)
    },    
    '/': function({app, req, res, isMobile, query}) {
      if (!isMobile) {
        app.render(req, res, '/index', {phone: false, ...query })
      } else {
        app.render(req, res, '/index', {phone: true, ...query})
      }
    },    
    ...nextRoutes,
    '*': function({handle, req, res, parsedUrl}) {
      handle(req, res, parsedUrl)
    },
  }
}

module.exports = customRoutes
```

Then use in your custom `server.js`

```js
const customRoutes = require('./customRoutes')
routesMiddleware({server, app}, customRoutes)
```

## Usage with next/link and styled-components for client-side routing

`styled-link.js`
```js
import Link from 'next/link'
import styled from 'styled-components'
import mkLink from 'next-routes-middleware/get-client-link'
import config from '../now.dev.json'
const getClientLink = mkLink(config)

const NextLink = ({href, className, children, ...rest}) => {
  const as = getClientLink(href)
  return <Link href={as} as={href} {...rest}>
    <a className={className} href={as}>{children}</a>
  </Link>
}

const StyledLink = styled(NextLink)`
  color: #067df7;
  text-decoration: none;
  font-size: 13px;
`

export default StyledLink
```

## Usage on client-side

```js
import StyledLink from './styled-link'
<Li>
  <StyledLink href='/w/test' passHref>Work</StyledLink>
</Li>
<Li>
  <StyledLink prefetch href="/resource/202eb9d7-feb3-407c-922e-e749159cb3ec" passHref>Resource</StyledLink>
</Li>
<Li>
  <StyledLink prefetch href="/t/hello-world/1999-12-31" passHref>More resource</StyledLink>
</Li>
```
