module.exports = {
	
	getObject3DDisplayName: (obj) => obj.name ? `${obj.name}` : `${obj.type} #${obj.id}`
	
}