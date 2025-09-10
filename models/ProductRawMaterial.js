module.exports = (sequelize, DataTypes) => {
  const ProductRawMaterial = sequelize.define('ProductRawMaterial', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    raw_material_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'raw_materials',
        key: 'id'
      }
    },
    quantity_required: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'product_raw_materials',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['product_id', 'raw_material_id']
      }
    ]
  });

  return ProductRawMaterial;
};
