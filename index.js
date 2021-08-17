const fs = require('fs');
const child_process = require('child_process');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const LZ4 = require('lz4');
const BUILD_DIR = 'build/';
const LZ4_COMPRESS = false;


const showUsage = ()=>{
	console.log('Improper usage, must provide a file with lists of binaries to copy.');
}

const readList = path=>{
	try{
		return fs.readFileSync(path).toString();
	} catch (e){
		console.error(e.toString());
		return;
	}

}

const readBinaries = list=>{
	 return list.split('\n').filter(file=>{
		if(!file) return;
		console.log(`Processing ${file}`);
		try{
			writeHeader(toSafeName(file),fs.readFileSync(file));
			return true;
		} catch (e){
			console.error(e.toString());
		}
	});
}

const setupBuild = ()=>{
	mkdirp.sync(BUILD_DIR);
	fs.copyFileSync('mcall_template.c', BUILD_DIR + 'mcall_template.c');
	fs.copyFileSync('lz4.c', BUILD_DIR + 'lz4.c');
	fs.copyFileSync('lz4.h', BUILD_DIR + 'lz4.h');
	//copy over template files
}

const writeHeader = (name,bytes)=>{
	const generatedHeader = genHeader(name,bytes);
	fs.writeFileSync(BUILD_DIR + name + '.h', generatedHeader);
}

const writeMetaheader = binaries =>{
	let body = binaries.map(binary=>`#include "${toSafeName(binary)}.h"`).join('\n');
	if(LZ4_COMPRESS) body = '#define LZ4\n' + body;
	fs.writeFileSync(BUILD_DIR + 'metaheader.h',body);
}


const toSafeName = name =>{
	return name.split('/').join('_').split('.').join('_');
}

const writeSelector = binaries =>{
	const body = binaries.map(binary=>{
		const nameSplit = binary.split('/');
		const shortName = nameSplit[nameSplit.length-1];
		const varName = toSafeName(binary);
		return `if(!strcmp(binary_name,"${shortName}")){ target_binary=${varName}; target_size = ${varName}_size;target_old_size = ${varName}_old_size;}`

	}).join('\n');
	fs.writeFileSync(BUILD_DIR + 'selector.c',body);
}

const genHeader = (name,bytes)=>{
	const old_size = bytes.length;
	let compressed;
	if(LZ4_COMPRESS)
		compressed = compressBytes(bytes);
	else
		compressed = bytes;

	return `char ${name}[] = {` + [...compressed].toString() + `};\nlong ${name}_size=sizeof(${name});long ${name}_old_size = ${old_size};`
}

const compressBytes = bytes=>{
	let output = Buffer.alloc(LZ4.encodeBound(bytes.length));
	const compressedSize = LZ4.encodeBlock(bytes, output);
	output = output.slice(0, compressedSize);
	return output;
}

const compileBinary = ()=>{
	child_process.execSync(`gcc ${BUILD_DIR}mcall_template.c ${LZ4_COMPRESS?'lz4.c':''} -o ${BUILD_DIR}mcall`,{stdio: 'inherit'});
}

const init = ()=>{
	if(process.argv.length < 3)
		return showUsage();
	const list = readList(process.argv[2]);
	if(!list) return;
	setupBuild();
	const binaries = readBinaries(list);
	writeMetaheader(binaries);
	writeSelector(binaries);
	compileBinary();

}
init();
