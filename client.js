const express = require("express")
const request = require("sync-request")
const url = require("url")
const qs = require("qs")
const querystring = require('querystring')
const cons = require('consolidate')
const randomstring = require("randomstring")
const __ = require('underscore')
__.string = require('underscore.string')

const app = express()

app.engine('html', cons.underscore)
app.set('view engine', 'html')
app.set('views', 'files/client')

// authorization server information
const authServer = {
	authorizationEndpoint: 'https://github.com/login/oauth/authorize',
	tokenEndpoint: 'https://github.com/login/oauth/access_token'
}

// client information


/*
 * TODO: Add the client information in here
 *
 * client_id: oauth-client-1
 * client_secret: oauth-client-secret-1
 */
const client = {
	"client_id": "c56a84da008b30c164cc", //TODO
	"client_secret": "98bdc413d47de4f49515c6352d289329c5080f3c", //TODO
	"redirect_uris": ["http://localhost:9000/callback"]
}

const protectedResource = 'https://api.github.com/user'

let state, access_token, scope = null

app.get('/', (req, res) => {
	res.render('index', {access_token: access_token, scope: scope})
})

app.get('/authorize', (req, res) => {

/* STEP 1: Send the user to the authorization server

	TODO: redirect to the authorization server with parameters:
	* response_type: code
	* scope: foo
	* client_id: <client_id>
	* redirect_uri: <redirect_uris>
	HTTP trace:

	HTTP/1.1 302 Moved Temporarily
	Location: http://authorization-server-url/authorize?response_type=code&scope=foo&client
	_id=client-id&redirect_uri=http%3A%2F%2Fclient-url%3A9000%2Fcallback

	hint: use res.redirect
 */
	res.redirect(302, authServer.authorizationEndpoint + '?login=nyandams&response_type=code&state=redux&scope=repo&client_id=' + 
					  client.client_id + '&redirect_uri=' + client.redirect_uris)
})

app.get('/callback', (req, res) => {

// STEP 2: Parse the response from the authorization server and get a token

	// Step 2.1: retrieve code from the req.query parameters object
	let code = req.query.code//TODO

	// Step 2.2: send the code to the token endpoint of the authorization server
	// this should be done using a Basic Auth (with the client_id as username and client_secret as password)
	// see https://en.wikipedia.org/wiki/Basic_access_authentication
	let form_data = qs.stringify({
		grant_type: 'authorization_code', // the type of authorization grant
		code: code,
		client_id: client.client_id,
		client_secret: client.client_secret,
		redirect_uris: client.redirect_uris[0]
	})

	let headers = {
		'Accept':'application/json',
		'Authorization': 'Bearer ' + encodeClientCredentials(client.client_id, client.client_secret) //TODO Basic Auth hints: you can use the encodeClientCredentials methode provided below)		
	}

	// Step 2.3: make a synchronize (for the sake of simplicity) request to the appropriate endpoint
	let tokRes = request('POST', authServer.tokenEndpoint, {
		headers: headers,
		body: form_data
	})

	// Step 2.4: parse the body of tokRes
	// hint: tokRes.getBody() to retrieve the body
	
	let body = JSON.parse(tokRes.getBody().toString()) // TODO
	/* body should be something like:
	{ 
		access_token: 'NGoMQgGfvjiJbp385Ox9tp1nQY9r3zlw',
		token_type: 'Bearer',
		scope: ''
	}
*/	

	access_token = body.access_token
	res.render('index', {access_token: access_token, scope: body.scope})
})

app.get('/fetch_resource', (req, res) => {

	// Step 3: Use the access token to call the resource server

	if (!access_token) {
		res.render('error', {error:'Mising access token'})
		return;
	}

	let headers = {
		// Step 3.1: Use the acess token with a Bearer authorization type
		// see https://tools.ietf.org/html/rfc6750#page-5
		'Authorization': 'token ' + access_token, //TODO
		'User-Agent': 'test'
	}
	console.log('token ' + access_token)

	// Step 3.2: send the request with the bearer authorization
	let resource = request('GET', protectedResource, {
		headers: headers
	})

	if(resource.statusCode >= 200 && resource.statusCode < 300){
		// Step 3.3: parse the result
		let body = JSON.parse(resource.getBody())
		res.render('data', {resource: body})
		return;
	}else {
		res.render('error', {error: `Server returned response code: ${resource.statusCode}`})
	}
})

const buildUrl = (base, options, hash) => {
	let newUrl = url.parse(base, true)
	delete newUrl.search
	if (!newUrl.query) {
		newUrl.query = {}
	}
	__.each(options, function(value, key, list) {
		newUrl.query[key] = value
	})
	if (hash) {
		newUrl.hash = hash
	}

	return url.format(newUrl)
}

const encodeClientCredentials = (clientId, clientSecret) => {
	return new Buffer(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64')
}

app.use('/', express.static('files/client'))

const server = app.listen(9000, 'localhost', () => {
  const {address: host, port: port} = server.address()
  console.log(`OAuth Client is listening at http://${host}:${port}`)
})
 
