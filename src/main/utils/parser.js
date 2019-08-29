import fs from 'fs';
import readline from 'readline';

const rePhylipHeader = /^\s*(\d+)\s+(\d+)(?:\s+([is]))?\s*$/; // 3  78  i (optional i/s for interleaved/sequential)
const reStrictPhylipLine = /^(.{10})(.+)$/;
const reRelaxedPhylipLine = /^(\w+)\s+(.+)$/;

export const parseAlignment = async (filePath) => {

  return new Promise((resolve, reject) => {

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      terminal: false,
    });

    const alignment = {
      numSequences: 0,
      length: 0,
      sequences: [],
      fileFormat: 'FASTA',
      filePath,
    };
    let lineCount = 0;
    let isPhylip = false; // assume FASTA format by default
    let isInterleaved = false;
    let isRelaxedPhylipDecided = false;
    let rePhylipLine = reStrictPhylipLine;
    let isFastaStarted = false;
    let isFastaTaxon = true;
    let taxon = '';
    let error = null;
    let code = [];

    const addSequence = () => {
      if (code.length === 0) { return; }
      const sequence = { taxon, code: code.join('') };
      alignment.sequences.push(sequence);
      code = [];
    }

    const parsePhylipLine = (line) => {
      if (!isRelaxedPhylipDecided) {
        const strictCharacterCount = line.substring(11).replace(/\s/g, "").length;
        if (strictCharacterCount > alignment.length) {
          isRelaxedPhylipDecided = true;
          rePhylipLine = reRelaxedPhylipLine;
          console.log('Parsing relaxed phylip format...');
        }
      }
      const match = rePhylipLine.exec(line);
      if (!match) {
        return false;
      }
      let [ _, taxon, code ] = match;
      //delete whitespaces
      code = code.replace(/\s/g, "");
      const sequence = { taxon, code };
      alignment.sequences.push(sequence);
    }

    const parseFastaLine = (line) => {
      if (!isFastaStarted) {
        if (line[0] !== '>') {
          return;
        }
        isFastaStarted = true;
      }
      isFastaTaxon = line[0] === '>';
      if (isFastaTaxon) {
        addSequence();
        taxon = line.substring(1).trim();
      } else {
        code.push(line.replace(/\s/g, ""));
      }
    }

    let parseLine = parseFastaLine;

    rl.on('line', (line) => {
      if (line.length === 0) {
        console.warn(`Warning: Line ${lineCount} empty in '${filePath}'`);
        return;
      }
      ++lineCount;
      if (lineCount === 1) {
        const match = rePhylipHeader.exec(line);
        if (match) {
          isPhylip = true;
          alignment.fileFormat = 'PHYLIP';
          alignment.numSequences = match[1];
          alignment.length = match[2];
          parseLine = parsePhylipLine;
          if (match[3] === 'i') {
            isInterleaved = true;
          }
          return;
        }
      }
      try {
        parseLine(line);
      }
      catch (err) {
        error = err;
        rl.close();
      }

    }).on('close', () => {
      if (error) {
        reject(error);
      } else {
        addSequence();
        if (alignment.sequences.length === 0) {
          return reject(new Error(`Couldn't parse any sequences from file ${filePath}`))
        }
        if (!isPhylip) {
          alignment.numSequences = alignment.sequences.length;
          alignment.length = alignment.sequences[0].code.length;
        }
        typecheckAlignment(alignment);
        const alignmentRestricted = Object.assign({}, alignment, { sequences: alignment.sequences.slice(0,2) });
        console.log('Alignment with first two sequences:', alignmentRestricted);
        resolve(alignment);
      }
    });

  });

}

export function typecheckAlignment(alignment) {
  const acgMatch = /[ACG]/i;
  const proteinMatch = /[EFIJLOPQZX\*]/i;
  const binaryMatch = /[01]/i;
  const multistateMatch = /2/i;
  const sequenceDataTypes = [];
  let numSequencesTypechecked = 0;
  for (const sequence of alignment.sequences) {
    const { code } = sequence;
    let dataType = undefined;
    if (proteinMatch.test(code)) {
      dataType = 'protein';
    } else if (acgMatch.test(code)) {
      const numT = (code.match(/T/ig) || []).length;
      const numU = (code.match(/U/ig) || []).length;
      if (numT > numU) {
        dataType = 'dna';
      } else {
        dataType = 'rna';
      }
    }

    const isBinary = binaryMatch.test(code);
    const isMultistate = multistateMatch.test(code);
    if (!dataType) {
      dataType = isMultistate ? 'multistate' : (isBinary ? 'binary' : undefined);
    } else if (isBinary || isMultistate) {
      dataType = 'mixed';
    }
    sequence.dataType = dataType;
    ++numSequencesTypechecked;
    sequenceDataTypes.push(sequence.dataType);
  }

  let dataType = sequenceDataTypes[0];
  const differentTypes = sequenceDataTypes.filter(type => type !== dataType);
  if (differentTypes.length > 0) {
    // Only valid case with different types is binary and multistate as [01] is a subset of [012].
    const isInvalid = sequenceDataTypes.find(type => type !== 'binary' && type !== 'multistate');
    dataType = isInvalid ? 'invalid' : 'multistate';
  }
  alignment.dataType = dataType;
  alignment.typecheckingComplete = true;
  return alignment;
}