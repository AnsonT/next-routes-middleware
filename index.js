const { parse } = require('url')
const { join, dirname } = require('path')
const pathMatch = require('path-match')
const route = pathMatch()
const url = require('url')
var XRegExp = require('xregexp');
const stringInject = require('stringinject').default
const walkSync = require('./walk-sync')

function _defaultRoutes(additionRoutes) {
  return {
    ...additionRoutes,
    '*': function({handle, req, res}) {
      handle(req, res)
    },
  }
}

const _nextRoutes = require.main.require('./now.dev.json');
async function routesMiddleware({server, app}, defaultRoutes = _defaultRoutes, nextRoutes = _nextRoutes) {
  const dev = process.env.NODE_ENV !== 'production';
  const patterns = nextRoutes.patterns
  const builders = nextRoutes.builds.map(function(item) {
    let dir = dirname(item.src)
    let newDir = dir
    if (item.use === '@now/next') {
      newDir = `${dir}/pages`
    } else if (item.use === '@now/static') {
      newDir = `${dir}/${item.src}`
    }
    const files = walkSync(newDir).map(function(it) { return it.file })
    return {
      ...item,
      files,
    }
  })
  
  function findBuilder(dest) {
    let tmp = null
    for(let i = 0; i < builders.length; i++) {
      const k = builders[i]
      if (k.use === '@now/next') {
        const pathdir = `pages${dest.split('?')[0]}.js`
        if (k.files.includes(pathdir)) {
          tmp = { builder: k, dirname: pathdir }
          break
        }
      } else if (k.use === '@now/static') {
        if (k.files.includes(dest)) {
          tmp = { builder: k, dirname: dest }
          break
        }
      }
    }
    return tmp
  }

  const modifiedRoutes = nextRoutes.routes.map(function(item) {
    const tmpSrc = stringInject(item.src, patterns).replace(/\$/g, "")
    const tmpMethod = item.method ? item.method : 'GET'
    const builder = findBuilder(item.dest)
    return {
      src: tmpSrc,
      dest: item.dest,
      method: tmpMethod,
      builder,
    }
  })


  let additionalRoutes = {}
  modifiedRoutes.forEach(function(item) {
    additionalRoutes[item.src] = function({req, res, query, pattern, next, method}) {
      if (item.builder) {
        if (item.builder.builder.use === '@now/next' && method === item.method) {    
          const resultUrl = XRegExp.replace(req.url, pattern, item.dest)
          const additionalParams = url.parse(resultUrl, true)
          const pathname = item.dest.split('?')[0]
          const finalQuery = {...additionalParams.query, ...query}
          app.render(req, res, pathname, finalQuery)
        } else if (item.builder.builder.use === '@now/static' && method === 'GET') {
          const filePath = item.dest
          app.serveStatic(req, res, filePath)
        }
      } else {
        return next()
      }
    }
  })

  const handle = app.getRequestHandler();
  const routes = defaultRoutes(additionalRoutes)
  const MobileDetect = require('mobile-detect')
  server.use(function(req, res, next) {
    const parsedUrl = parse(req.url, true)
    const { pathname, query } = parsedUrl
    const md = new MobileDetect(req.headers['user-agent']);
    const isMobile = md.mobile()
    const method = req.method

    for(let item in additionalRoutes) {
      if (additionalRoutes.hasOwnProperty(item)) {
        const pattern = XRegExp(item)
        let result = XRegExp.exec(req.url, pattern)
        if (result) {
          return additionalRoutes[item]({
            req, res, next, handle, query, isMobile, join, dev, pattern, method
          })          
        }
      }      
    }
    
    for (let k in routes) {
      if (routes.hasOwnProperty(k)) {
        const params = route(k)(pathname)
        if (params) {
          return routes[k]({app, req, res, next, handle, query, pathname, isMobile, join, params, dev, method})
        }
      }
    }
  });
}

module.exports = routesMiddleware
