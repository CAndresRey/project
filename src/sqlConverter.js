const { Parser } = require('node-sql-parser');
const _ = require('lodash');
const { format } = require('date-fns');

const parser = new Parser();
const OPTIONS = {
  database: 'MySQL'
};

function transformAST(ast) {
  if (Array.isArray(ast)) {
    return ast.map(node => transformAST(node));
  }
  
  if (!ast || typeof ast !== 'object') return ast;
}
  // Transform based on node type
  switch (ast.type) {
    case 'create':
      return transformCreateTable(ast);
    case 'select':
      return transformSelect(ast);
    case 'insert':
      return transformInsert(ast);
    case 'function':
      return transformFunction(ast);
    default:
      return _.mapValues(ast, value => transformAST(value));
  }


function convertToMSSQL(mysqlQuery) {
  try {
    const ast = parser.parse(mysqlQuery, OPTIONS);
    const transformedAst = transformAST(ast);
    return parser.sqlify(transformedAst);
  } catch (error) {
    // Fallback to regex-based conversion if parsing fails
    return regexBasedConversion(mysqlQuery);
  }
}

function transformCreateTable(ast) {
  const tableAst = _.cloneDeep(ast);
  
  // Transform column definitions
  tableAst.create_definitions = tableAst.create_definitions.map(def => {
    if (def.resource === 'column') {
      def.column_definition = transformColumnType(def.column_definition);
    }
    return def;
  });

  return tableAst;
}

function transformColumnType(colDef) {
  const typeMap = {
    'INT': 'INT',
    'TINYINT': 'TINYINT',
    'SMALLINT': 'SMALLINT',
    'MEDIUMINT': 'INT',
    'BIGINT': 'BIGINT',
    'FLOAT': 'FLOAT',
    'DOUBLE': 'FLOAT',
    'DECIMAL': 'DECIMAL',
    'DATE': 'DATE',
    'DATETIME': 'DATETIME2',
    'TIMESTAMP': 'DATETIME2',
    'TIME': 'TIME',
    'YEAR': 'SMALLINT',
    'CHAR': 'CHAR',
    'VARCHAR': 'VARCHAR',
    'BINARY': 'BINARY',
    'VARBINARY': 'VARBINARY',
    'TINYBLOB': 'VARBINARY(MAX)',
    'BLOB': 'VARBINARY(MAX)',
    'MEDIUMBLOB': 'VARBINARY(MAX)',
    'LONGBLOB': 'VARBINARY(MAX)',
    'TINYTEXT': 'NVARCHAR(255)',
    'TEXT': 'NVARCHAR(MAX)',
    'MEDIUMTEXT': 'NVARCHAR(MAX)',
    'LONGTEXT': 'NVARCHAR(MAX)',
    'ENUM': 'NVARCHAR(255)',
    'SET': 'NVARCHAR(255)',
    'JSON': 'NVARCHAR(MAX)',
    'GEOMETRY': 'GEOMETRY',
    'POINT': 'GEOMETRY',
    'LINESTRING': 'GEOMETRY',
    'POLYGON': 'GEOMETRY',
    'MULTIPOINT': 'GEOMETRY',
    'MULTILINESTRING': 'GEOMETRY',
    'MULTIPOLYGON': 'GEOMETRY',
    'GEOMETRYCOLLECTION': 'GEOMETRY'
  };

  const def = _.cloneDeep(colDef);
  def.dataType = typeMap[def.dataType.toUpperCase()] || def.dataType;
  
  // Transform auto_increment
  if (def.auto_increment) {
    def.auto_increment = false;
    def.identity = { start: 1, increment: 1 };
  }

  return def;
}

function transformSelect(ast) {
  const selectAst = _.cloneDeep(ast);

  // Transform limit clause to TOP or OFFSET FETCH
  if (selectAst.limit) {
    if (selectAst.limit.offset) {
      selectAst.options = {
        ...selectAst.options,
        offset: selectAst.limit.offset,
        fetch: selectAst.limit.value
      };
    } else {
      selectAst.options = {
        ...selectAst.options,
        top: selectAst.limit.value
      };
    }
    delete selectAst.limit;
  }

  // Transform functions in columns
  if (selectAst.columns) {
    selectAst.columns = selectAst.columns.map(col => {
      if (col.expr && col.expr.type === 'function') {
        col.expr = transformFunction(col.expr);
      }
      return col;
    });
  }

  return selectAst;
}

function transformInsert(ast) {
  const insertAst = _.cloneDeep(ast);
  
  // Transform INSERT IGNORE to MERGE
  if (insertAst.ignore) {
    insertAst.type = 'merge';
    insertAst.merge = {
      into: insertAst.table,
      using: {
        type: 'values',
        values: insertAst.values
      },
      on: {
        type: 'binary_expr',
        operator: '=',
        left: { type: 'column_ref', table: 'target', column: 'id' },
        right: { type: 'column_ref', table: 'source', column: 'id' }
      },
      matches: [
        {
          type: 'not_matched',
          action: {
            type: 'insert',
            columns: insertAst.columns,
            values: insertAst.values
          }
        }
      ]
    };
    delete insertAst.ignore;
  }

  return insertAst;
}

function transformFunction(ast) {
  const funcAst = _.cloneDeep(ast);
  
  const functionMap = {
    'NOW': 'GETDATE',
    'CURRENT_TIMESTAMP': 'GETDATE',
    'UNIX_TIMESTAMP': (args) => ({
      type: 'function',
      name: 'DATEDIFF',
      args: {
        type: 'expr_list',
        value: [
          { type: 'string', value: 'SECOND' },
          { type: 'string', value: '1970-01-01' },
          args ? args.value[0] : { type: 'function', name: 'GETDATE', args: { type: 'expr_list', value: [] } }
        ]
      }
    }),
    'GROUP_CONCAT': 'STRING_AGG',
    'CONCAT': (args) => ({
      type: 'binary_expr',
      operator: '+',
      left: args.value[0],
      right: args.value[1]
    }),
    'IFNULL': 'ISNULL',
    'LOCATE': 'CHARINDEX',
    'LENGTH': 'LEN'
  };

  const func = functionMap[funcAst.name.toUpperCase()];
  if (typeof func === 'function') {
    return func(funcAst.args);
  } else if (func) {
    funcAst.name = func;
  }

  return funcAst;
}

function transformJoin(ast) {
  const joinAst = _.cloneDeep(ast);
  
  // Transform NATURAL JOIN to regular JOIN
  if (joinAst.natural) {
    delete joinAst.natural;
    joinAst.type = 'join';
    // Add ON clause based on matching column names
    // This would require schema information in a real implementation
  }

  return joinAst;
}

function regexBasedConversion(query) {
  // Keep existing regex-based conversion as fallback
  query = query.trim();
  
  // Handle empty query
  if (!query) {
    throw new Error('Empty query provided');
  }

  // Convert MySQL comments to SQLite comments
  query = query.replace(/\/\*!.*?\*\//g, ''); // Remove MySQL-specific comments
  
  // Handle MySQL-specific data types in CREATE TABLE
  if (query.toUpperCase().includes('CREATE TABLE')) {
    query = query
      // Basic data types
      .replace(/AUTO_INCREMENT/gi, 'IDENTITY(1,1)')
      .replace(/UNSIGNED/gi, '')
      .replace(/ENUM\([^)]+\)/gi, 'VARCHAR(255)')
      .replace(/SET\([^)]+\)/gi, 'VARCHAR(255)')
      .replace(/TINYINT\(\d+\)/gi, 'TINYINT')
      .replace(/SMALLINT\(\d+\)/gi, 'SMALLINT')
      .replace(/MEDIUMINT\(\d+\)/gi, 'INT')
      .replace(/INT\(\d+\)/gi, 'INT')
      .replace(/BIGINT\(\d+\)/gi, 'BIGINT')
      // Floating point types
      .replace(/DOUBLE(\(\d+,\d+\))?/gi, 'FLOAT')
      .replace(/FLOAT(\(\d+,\d+\))?/gi, 'FLOAT')
      .replace(/DECIMAL(\(\d+,\d+\))?/gi, 'DECIMAL$1')
      // Date and time types
      .replace(/DATETIME(\(\d+\))?/gi, 'DATETIME2')
      .replace(/TIMESTAMP(\(\d+\))?/gi, 'DATETIME2')
      .replace(/TIME(\(\d+\))?/gi, 'TIME')
      .replace(/DATE/gi, 'DATE')
      .replace(/YEAR/gi, 'SMALLINT')
      // Text types
      .replace(/LONGTEXT/gi, 'NVARCHAR(MAX)')
      .replace(/MEDIUMTEXT/gi, 'NVARCHAR(MAX)')
      .replace(/TINYTEXT/gi, 'NVARCHAR(255)')
      .replace(/VARCHAR\(\d+\)/gi, match => match.toUpperCase())
      .replace(/CHAR\(\d+\)/gi, match => match.toUpperCase())
      // Binary types
      .replace(/BLOB/gi, 'VARBINARY(MAX)')
      .replace(/LONGBLOB/gi, 'VARBINARY(MAX)')
      .replace(/MEDIUMBLOB/gi, 'VARBINARY(MAX)')
      .replace(/TINYBLOB/gi, 'VARBINARY(255)')
      .replace(/VARBINARY\(\d+\)/gi, match => match.toUpperCase())
      .replace(/BINARY\(\d+\)/gi, match => match.toUpperCase())
      // Remove MySQL-specific table options
      .replace(/CHARACTER SET \w+/gi, '')
      .replace(/COLLATE \w+/gi, '')
      .replace(/ENGINE\s*=\s*\w+/gi, '')
      .replace(/DEFAULT CHARSET\s*=\s*\w+/gi, '')
      .replace(/ROW_FORMAT\s*=\s*\w+/gi, '')
      // Convert default value syntax
      .replace(/DEFAULT CURRENT_TIMESTAMP(\(\d*\))?/gi, "DEFAULT GETDATE()")
      .replace(/DEFAULT NULL/gi, 'DEFAULT NULL')
      .replace(/NOT NULL AUTO_INCREMENT/gi, 'NOT NULL IDENTITY(1,1)')
      // Additional data type conversions
      .replace(/BOOLEAN/gi, 'BIT')
      .replace(/JSON/gi, 'NVARCHAR(MAX)')
      .replace(/POINT/gi, 'GEOMETRY')
      .replace(/POLYGON/gi, 'GEOMETRY')
      .replace(/LINESTRING/gi, 'GEOMETRY')
      .replace(/MULTIPOINT/gi, 'GEOMETRY')
      .replace(/MULTIPOLYGON/gi, 'GEOMETRY')
      .replace(/MULTILINESTRING/gi, 'GEOMETRY')
      .replace(/GEOMETRYCOLLECTION/gi, 'GEOMETRY')
      // Handle bit fields
      .replace(/BIT\(\d+\)/gi, 'VARBINARY(MAX)')
      // Additional defaults
      .replace(/DEFAULT CURRENT_DATE/gi, "DEFAULT CAST(GETDATE() AS DATE)")
      .replace(/DEFAULT CURRENT_TIME/gi, "DEFAULT CAST(GETDATE() AS TIME)");

    // Handle table constraints
    if (query.includes('FOREIGN KEY')) {
      query = query.replace(/REFERENCES\s+(\w+)\s*\(([^)]+)\)\s*ON\s+DELETE\s+CASCADE/gi,
        'REFERENCES $1($2) ON DELETE CASCADE');
      query = query.replace(/REFERENCES\s+(\w+)\s*\(([^)]+)\)\s*ON\s+UPDATE\s+CASCADE/gi,
        'REFERENCES $1($2) ON UPDATE CASCADE');
    }
  }
  
  // Convert backticks to square brackets for MSSQL
  query = query.replace(/`([^`]+)`/g, '[$1]');
  
  // Convert LIMIT and OFFSET to MSSQL syntax
  const limitOffsetRegex = /LIMIT\s+(\d+)(?:\s*,\s*(\d+))?|LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/gi;
  query = query.replace(limitOffsetRegex, (match, limit1, limit2, limit3, offset) => {
    if (limit2) {
      return `OFFSET ${limit1} ROWS FETCH NEXT ${limit2} ROWS ONLY`;
    } else if (offset) {
      return `OFFSET ${offset} ROWS FETCH NEXT ${limit3} ROWS ONLY`;
    }
    return `TOP ${limit1}`;
  });

  // Convert MySQL functions to MSSQL equivalents
  query = query
    // String concatenation
    .replace(/CONCAT\((.*?)\)/gi, (match, args) => {
      const parts = args.split(',').map(part => part.trim());
      return parts.join(' + ');
    })
    .replace(/CONCAT_WS\((['"])([^'"]+)\1,\s*(.*?)\)/gi, (match, quote, separator, args) => {
      const parts = args.split(',').map(part => part.trim());
      return parts.join(` + '${separator}' + `);
    })
    // Date/Time functions
    .replace(/NOW\(\)/gi, "GETDATE()")
    .replace(/CURRENT_TIMESTAMP\(\)/gi, "GETDATE()")
    .replace(/CURRENT_DATE\(\)/gi, "CAST(GETDATE() AS DATE)")
    .replace(/CURRENT_TIME\(\)/gi, "CAST(GETDATE() AS TIME)")
    .replace(/DATE_FORMAT\(([^,]+),\s*['"]([^'"]+)['"]\)/gi, "FORMAT($1, '$2')")
    .replace(/UNIX_TIMESTAMP\(\)/gi, "DATEDIFF(SECOND, '1970-01-01', GETDATE())")
    .replace(/FROM_UNIXTIME\(([^)]+)\)/gi, "DATEADD(SECOND, $1, '1970-01-01')")
    .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+(\d+)\s+(\w+)\)/gi, 
      (match, date, number, unit) => `DATEADD(${unit}, ${number}, ${date})`)
    .replace(/DATE_SUB\(([^,]+),\s*INTERVAL\s+(\d+)\s+(\w+)\)/gi, 
      (match, date, number, unit) => `DATEADD(${unit}, -${number}, ${date})`)
    .replace(/DAYOFWEEK\(([^)]+)\)/gi, "DATEPART(WEEKDAY, $1)")
    .replace(/WEEKDAY\(([^)]+)\)/gi, "DATEPART(WEEKDAY, $1) - 1")
    .replace(/DAYOFYEAR\(([^)]+)\)/gi, "DATEPART(DAYOFYEAR, $1)")
    .replace(/DAYOFMONTH\(([^)]+)\)/gi, "DATEPART(DAY, $1)")
    .replace(/YEAR\(([^)]+)\)/gi, "DATEPART(YEAR, $1)")
    .replace(/MONTH\(([^)]+)\)/gi, "DATEPART(MONTH, $1)")
    .replace(/QUARTER\(([^)]+)\)/gi, "DATEPART(QUARTER, $1)")
    // String functions
    .replace(/SUBSTR\((.*?)\)/gi, 'SUBSTRING($1)')
    .replace(/SUBSTRING\((.*?)\)/gi, 'SUBSTRING($1)')
    .replace(/LCASE\((.*?)\)/gi, 'LOWER($1)')
    .replace(/UCASE\((.*?)\)/gi, 'UPPER($1)')
    .replace(/LENGTH\((.*?)\)/gi, 'LEN($1)')
    .replace(/LOCATE\(([^,]+),([^)]+)\)/gi, "CHARINDEX($1, $2)")
    .replace(/FIELD\((.*?)\)/gi, (match, args) => {
      const parts = args.split(',').map(p => p.trim());
      const searchValue = parts[0];
      const list = parts.slice(1);
      return `(CASE ${list.map((item, i) => 
        `WHEN ${searchValue} = ${item} THEN ${i + 1}`).join(' ')} ELSE 0 END)`;
    })
    .replace(/FIND_IN_SET\(([^,]+),([^)]+)\)/gi, 
      `CHARINDEX($1, REPLACE($2, ',', ' '))`)
    // Numeric functions
    .replace(/RAND\(\)/gi, 'RAND()')
    .replace(/FLOOR\((.*?)\)/gi, 'FLOOR($1)')
    .replace(/CEILING\((.*?)\)/gi, 'CEILING($1)')
    // Control flow
    .replace(/IFNULL\((.*?),(.*?)\)/gi, 'ISNULL($1,$2)')
    .replace(/IF\((.*?),(.*?),(.*?)\)/gi, 'CASE WHEN $1 THEN $2 ELSE $3 END');

  // Handle window functions
  query = query
    .replace(/ROW_NUMBER\(\)\s+OVER\s*\((.*?)\)/gi, "ROW_NUMBER() OVER ($1)")
    .replace(/RANK\(\)\s+OVER\s*\((.*?)\)/gi, "RANK() OVER ($1)")
    .replace(/DENSE_RANK\(\)\s+OVER\s*\((.*?)\)/gi, "DENSE_RANK() OVER ($1)")
    .replace(/NTILE\((\d+)\)\s+OVER\s*\((.*?)\)/gi, "NTILE($1) OVER ($2)");

  // Convert MySQL regular expressions
  query = query
    .replace(/REGEXP_LIKE\(([^,]+),\s*([^)]+)\)/gi, "$1 LIKE $2")
    .replace(/NOT\s+REGEXP/gi, "NOT LIKE")
    .replace(/REGEXP/gi, "LIKE");

  // Convert MySQL specific JOIN syntax
  query = query
    .replace(/STRAIGHT_JOIN/gi, "INNER JOIN")
    .replace(/NATURAL\s+JOIN/gi, "INNER JOIN")
    .replace(/NATURAL\s+LEFT\s+JOIN/gi, "LEFT JOIN")
    .replace(/NATURAL\s+RIGHT\s+JOIN/gi, "RIGHT JOIN");

  // Handle fulltext search conversion
  query = query
    .replace(/MATCH\s*\((.*?)\)\s*AGAINST\s*\(([^)]+)\s*IN\s*BOOLEAN\s*MODE\)/gi,
      "CONTAINS(($1), $2)")
    .replace(/MATCH\s*\((.*?)\)\s*AGAINST\s*\(([^)]+)\)/gi,
      "FREETEXT(($1), $2)");

  // Handle INSERT IGNORE (convert to MERGE)
  if (query.toUpperCase().includes('INSERT IGNORE')) {
    query = query.replace(/INSERT IGNORE INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i, 
      'MERGE INTO $1 WITH (HOLDLOCK) AS target USING (SELECT $3) AS source ($2) ' +
      'ON target.id = source.id ' +
      'WHEN NOT MATCHED THEN INSERT ($2) VALUES ($3);'
    );
  }

  // Handle REPLACE INTO (convert to MERGE)
  if (query.toUpperCase().includes('REPLACE INTO')) {
    query = query.replace(/REPLACE INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i,
      'MERGE INTO $1 WITH (HOLDLOCK) AS target USING (SELECT $3) AS source ($2) ' +
      'ON target.id = source.id ' +
      'WHEN MATCHED THEN UPDATE SET $2 = source.$2 ' +
      'WHEN NOT MATCHED THEN INSERT ($2) VALUES ($3);'
    );
  }

  // Convert GROUP_CONCAT to STRING_AGG
  query = query.replace(/GROUP_CONCAT\((.*?)\)/gi, 'STRING_AGG($1, \',\')');

  // Handle MySQL-specific operators
  query = query
    .replace(/\|\|/g, '+')    // String concatenation
    .replace(/&&/g, 'AND')    // Logical AND
    .replace(/DIV/gi, '/')    // Integer division
    .replace(/MOD/gi, '%');   // Modulo

  return query;
}

module.exports = { convertToMSSQL };