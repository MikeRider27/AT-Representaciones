package vista;

import controlador.conexion;
import javax.swing.JOptionPane;
import javax.swing.table.DefaultTableModel;

public class cobro_cliente extends javax.swing.JFrame {

    conexion bd = new conexion();
    String accion = "";

    public cobro_cliente() {
        initComponents();
        bd.conecta();
        paneltarjeta.setVisible(false);
        panelcheques.setVisible(false);

    }

    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jLabel1 = new javax.swing.JLabel();
        jScrollPane1 = new javax.swing.JScrollPane();
        tablacuenta = new javax.swing.JTable();
        btnuevo = new javax.swing.JButton();
        btgrabar = new javax.swing.JButton();
        btcancelar = new javax.swing.JButton();
        btanular = new javax.swing.JButton();
        jLabel3 = new javax.swing.JLabel();
        jLabel2 = new javax.swing.JLabel();
        jLabel4 = new javax.swing.JLabel();
        jLabel5 = new javax.swing.JLabel();
        jLabel6 = new javax.swing.JLabel();
        txtidcliente = new javax.swing.JTextField();
        jLabel7 = new javax.swing.JLabel();
        txtcliente = new javax.swing.JLabel();
        jPanel1 = new javax.swing.JPanel();
        cbtipo = new javax.swing.JComboBox<>();
        jLabel10 = new javax.swing.JLabel();
        jTextField2 = new javax.swing.JTextField();
        jLabel11 = new javax.swing.JLabel();
        jLabel12 = new javax.swing.JLabel();
        jTextField3 = new javax.swing.JTextField();
        paneltarjeta = new javax.swing.JPanel();
        jLabel13 = new javax.swing.JLabel();
        jTextField4 = new javax.swing.JTextField();
        jLabel15 = new javax.swing.JLabel();
        jTextField5 = new javax.swing.JTextField();
        jLabel17 = new javax.swing.JLabel();
        jTextField6 = new javax.swing.JTextField();
        jLabel9 = new javax.swing.JLabel();
        jTextField7 = new javax.swing.JTextField();
        jTextField8 = new javax.swing.JTextField();
        jLabel18 = new javax.swing.JLabel();
        jComboBox2 = new javax.swing.JComboBox<>();
        jComboBox3 = new javax.swing.JComboBox<>();
        btcobrar = new javax.swing.JButton();
        panelcheques = new javax.swing.JPanel();
        jLabel19 = new javax.swing.JLabel();
        jLabel20 = new javax.swing.JLabel();
        jLabel21 = new javax.swing.JLabel();
        jLabel22 = new javax.swing.JLabel();
        jTextField9 = new javax.swing.JTextField();
        jTextField10 = new javax.swing.JTextField();
        jTextField11 = new javax.swing.JTextField();
        jTextField12 = new javax.swing.JTextField();
        jLabel23 = new javax.swing.JLabel();
        jLabel24 = new javax.swing.JLabel();
        jLabel25 = new javax.swing.JLabel();
        jLabel26 = new javax.swing.JLabel();
        jLabel27 = new javax.swing.JLabel();
        jScrollPane2 = new javax.swing.JScrollPane();
        tabladetalle = new javax.swing.JTable();
        jLabel28 = new javax.swing.JLabel();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        setTitle("Cobro Cliente");
        setType(java.awt.Window.Type.UTILITY);
        getContentPane().setLayout(null);

        jLabel1.setText("Factura Numero");
        getContentPane().add(jLabel1);
        jLabel1.setBounds(170, 20, 130, 14);

        tablacuenta.setModel(new javax.swing.table.DefaultTableModel(
            new Object [][] {

            },
            new String [] {
                "Factura", "Nro Cuota", "Fecha Vto", "Cuota", "Saldo"
            }
        ) {
            boolean[] canEdit = new boolean [] {
                false, true, false, false, false
            };

            public boolean isCellEditable(int rowIndex, int columnIndex) {
                return canEdit [columnIndex];
            }
        });
        jScrollPane1.setViewportView(tablacuenta);

        getContentPane().add(jScrollPane1);
        jScrollPane1.setBounds(570, 180, 340, 120);

        btnuevo.setText("Nuevo");
        btnuevo.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                btnuevoActionPerformed(evt);
            }
        });
        getContentPane().add(btnuevo);
        btnuevo.setBounds(830, 10, 90, 23);

        btgrabar.setText("Grabar");
        getContentPane().add(btgrabar);
        btgrabar.setBounds(830, 40, 90, 23);

        btcancelar.setText("Cancelar");
        getContentPane().add(btcancelar);
        btcancelar.setBounds(830, 100, 90, 23);

        btanular.setText("Anular");
        getContentPane().add(btanular);
        btanular.setBounds(830, 70, 90, 23);

        jLabel3.setText("Numero de Registro");
        getContentPane().add(jLabel3);
        jLabel3.setBounds(20, 20, 130, 14);

        jLabel2.setText("021212-12121-1445");
        getContentPane().add(jLabel2);
        jLabel2.setBounds(180, 50, 130, 14);

        jLabel4.setText("01");
        getContentPane().add(jLabel4);
        jLabel4.setBounds(50, 50, 130, 14);

        jLabel5.setText("Fecha");
        getContentPane().add(jLabel5);
        jLabel5.setBounds(650, 20, 70, 14);

        jLabel6.setText("13/11/2018");
        getContentPane().add(jLabel6);
        jLabel6.setBounds(640, 40, 130, 14);

        txtidcliente.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                txtidclienteKeyPressed(evt);
            }
        });
        getContentPane().add(txtidcliente);
        txtidcliente.setBounds(329, 50, 50, 20);

        jLabel7.setText("Cliente");
        getContentPane().add(jLabel7);
        jLabel7.setBounds(380, 20, 70, 14);

        txtcliente.setFont(new java.awt.Font("Tahoma", 0, 14)); // NOI18N
        txtcliente.setText("Nombre");
        getContentPane().add(txtcliente);
        txtcliente.setBounds(420, 50, 130, 17);

        jPanel1.setBorder(javax.swing.BorderFactory.createTitledBorder(javax.swing.BorderFactory.createLineBorder(new java.awt.Color(0, 0, 0)), "Tipo de Pago", javax.swing.border.TitledBorder.DEFAULT_JUSTIFICATION, javax.swing.border.TitledBorder.DEFAULT_POSITION, new java.awt.Font("Tahoma", 0, 11), new java.awt.Color(0, 153, 204))); // NOI18N
        jPanel1.setLayout(null);

        cbtipo.setModel(new javax.swing.DefaultComboBoxModel<>(new String[] { "Efectivo", "Tarjeta", "Cheque" }));
        jPanel1.add(cbtipo);
        cbtipo.setBounds(160, 30, 140, 30);

        getContentPane().add(jPanel1);
        jPanel1.setBounds(50, 120, 460, 80);

        jLabel10.setText("Monto a Pagar");
        getContentPane().add(jLabel10);
        jLabel10.setBounds(110, 220, 100, 14);
        getContentPane().add(jTextField2);
        jTextField2.setBounds(90, 240, 120, 30);

        jLabel11.setText("Monto Pagado");
        getContentPane().add(jLabel11);
        jLabel11.setBounds(260, 220, 90, 14);

        jLabel12.setText("Pagos Realizados");
        getContentPane().add(jLabel12);
        jLabel12.setBounds(700, 330, 100, 14);
        getContentPane().add(jTextField3);
        jTextField3.setBounds(260, 240, 100, 30);

        paneltarjeta.setBorder(javax.swing.BorderFactory.createTitledBorder(javax.swing.BorderFactory.createLineBorder(new java.awt.Color(0, 0, 0)), "Tarjetas"));
        paneltarjeta.setLayout(null);

        jLabel13.setText("Tipo de Tarjeta");
        paneltarjeta.add(jLabel13);
        jLabel13.setBounds(90, 50, 90, 14);
        paneltarjeta.add(jTextField4);
        jTextField4.setBounds(70, 70, 30, 20);

        jLabel15.setText("Numero de Tarjeta");
        paneltarjeta.add(jLabel15);
        jLabel15.setBounds(70, 110, 130, 14);
        paneltarjeta.add(jTextField5);
        jTextField5.setBounds(280, 60, 40, 20);

        jLabel17.setText("Marca");
        paneltarjeta.add(jLabel17);
        jLabel17.setBounds(310, 40, 29, 14);
        paneltarjeta.add(jTextField6);
        jTextField6.setBounds(280, 130, 120, 20);

        jLabel9.setText("Numero de Boleta");
        paneltarjeta.add(jLabel9);
        jLabel9.setBounds(280, 110, 110, 14);
        paneltarjeta.add(jTextField7);
        jTextField7.setBounds(70, 130, 120, 20);
        paneltarjeta.add(jTextField8);
        jTextField8.setBounds(100, 180, 290, 20);

        jLabel18.setText("Observacion ");
        paneltarjeta.add(jLabel18);
        jLabel18.setBounds(200, 160, 110, 14);

        jComboBox2.setModel(new javax.swing.DefaultComboBoxModel<>(new String[] { "VISA" }));
        paneltarjeta.add(jComboBox2);
        jComboBox2.setBounds(330, 60, 80, 20);

        jComboBox3.setModel(new javax.swing.DefaultComboBoxModel<>(new String[] { "Debito", "Credito" }));
        paneltarjeta.add(jComboBox3);
        jComboBox3.setBounds(120, 70, 100, 20);

        getContentPane().add(paneltarjeta);
        paneltarjeta.setBounds(50, 280, 460, 210);

        btcobrar.setText("Cobrar");
        getContentPane().add(btcobrar);
        btcobrar.setBounds(410, 220, 65, 23);

        panelcheques.setBorder(javax.swing.BorderFactory.createTitledBorder(javax.swing.BorderFactory.createLineBorder(new java.awt.Color(0, 0, 0)), "Cheques"));
        panelcheques.setLayout(null);

        jLabel19.setText("Observación");
        panelcheques.add(jLabel19);
        jLabel19.setBounds(40, 150, 130, 20);

        jLabel20.setText("Banco");
        panelcheques.add(jLabel20);
        jLabel20.setBounds(260, 40, 50, 20);

        jLabel21.setText("Fecha de Cheque");
        panelcheques.add(jLabel21);
        jLabel21.setBounds(120, 100, 130, 20);

        jLabel22.setText("Nro. de Cheque");
        panelcheques.add(jLabel22);
        jLabel22.setBounds(20, 40, 130, 20);
        panelcheques.add(jTextField9);
        jTextField9.setBounds(130, 40, 90, 20);
        panelcheques.add(jTextField10);
        jTextField10.setBounds(230, 100, 90, 20);
        panelcheques.add(jTextField11);
        jTextField11.setBounds(150, 150, 250, 20);
        panelcheques.add(jTextField12);
        jTextField12.setBounds(310, 40, 40, 20);

        jLabel23.setText("Banco X");
        panelcheques.add(jLabel23);
        jLabel23.setBounds(360, 40, 80, 14);

        getContentPane().add(panelcheques);
        panelcheques.setBounds(50, 500, 460, 190);

        jLabel24.setText("Saldo");
        getContentPane().add(jLabel24);
        jLabel24.setBounds(850, 500, 50, 14);

        jLabel25.setText("0");
        getContentPane().add(jLabel25);
        jLabel25.setBounds(850, 530, 50, 14);

        jLabel26.setText("Total");
        getContentPane().add(jLabel26);
        jLabel26.setBounds(630, 500, 30, 14);

        jLabel27.setText("150.000");
        getContentPane().add(jLabel27);
        jLabel27.setBounds(620, 530, 50, 14);

        tabladetalle.setModel(new javax.swing.table.DefaultTableModel(
            new Object [][] {

            },
            new String [] {
                "Factura", "Monto Pagado", "Tipo Pago", "Estado"
            }
        ));
        jScrollPane2.setViewportView(tabladetalle);

        getContentPane().add(jScrollPane2);
        jScrollPane2.setBounds(570, 360, 340, 120);

        jLabel28.setText("Detalle de Cuenta");
        getContentPane().add(jLabel28);
        jLabel28.setBounds(700, 160, 130, 14);

        setSize(new java.awt.Dimension(947, 741));
        setLocationRelativeTo(null);
    }// </editor-fold>//GEN-END:initComponents

    private void btnuevoActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_btnuevoActionPerformed
//        accion = "nuevo";
//        bd.autonumerico("billetera", "id_billetera", txtid);
    }//GEN-LAST:event_btnuevoActionPerformed

    private void txtidclienteKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_txtidclienteKeyPressed
       
        
        cargar_cliente();
                
    }//GEN-LAST:event_txtidclienteKeyPressed

    public static void main(String args[]) {
        /* Set the Nimbus look and feel */
        //<editor-fold defaultstate="collapsed" desc=" Look and feel setting code (optional) ">
        /* If Nimbus (introduced in Java SE 6) is not available, stay with the default look and feel.
         * For details see http://download.oracle.com/javase/tutorial/uiswing/lookandfeel/plaf.html 
         */
        try {
            for (javax.swing.UIManager.LookAndFeelInfo info : javax.swing.UIManager.getInstalledLookAndFeels()) {
                if ("Nimbus".equals(info.getName())) {
                    javax.swing.UIManager.setLookAndFeel(info.getClassName());
                    break;
                }
            }
        } catch (ClassNotFoundException ex) {
            java.util.logging.Logger.getLogger(cobro_cliente.class.getName()).log(java.util.logging.Level.SEVERE, null, ex);
        } catch (InstantiationException ex) {
            java.util.logging.Logger.getLogger(cobro_cliente.class.getName()).log(java.util.logging.Level.SEVERE, null, ex);
        } catch (IllegalAccessException ex) {
            java.util.logging.Logger.getLogger(cobro_cliente.class.getName()).log(java.util.logging.Level.SEVERE, null, ex);
        } catch (javax.swing.UnsupportedLookAndFeelException ex) {
            java.util.logging.Logger.getLogger(cobro_cliente.class.getName()).log(java.util.logging.Level.SEVERE, null, ex);
        }
        //</editor-fold>

        /* Create and display the form */
        java.awt.EventQueue.invokeLater(new Runnable() {
            public void run() {
                new cobro_cliente().setVisible(true);
            }
        });
    }

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton btanular;
    private javax.swing.JButton btcancelar;
    private javax.swing.JButton btcobrar;
    private javax.swing.JButton btgrabar;
    private javax.swing.JButton btnuevo;
    private javax.swing.JComboBox<String> cbtipo;
    private javax.swing.JComboBox<String> jComboBox2;
    private javax.swing.JComboBox<String> jComboBox3;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel10;
    private javax.swing.JLabel jLabel11;
    private javax.swing.JLabel jLabel12;
    private javax.swing.JLabel jLabel13;
    private javax.swing.JLabel jLabel15;
    private javax.swing.JLabel jLabel17;
    private javax.swing.JLabel jLabel18;
    private javax.swing.JLabel jLabel19;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabel20;
    private javax.swing.JLabel jLabel21;
    private javax.swing.JLabel jLabel22;
    private javax.swing.JLabel jLabel23;
    private javax.swing.JLabel jLabel24;
    private javax.swing.JLabel jLabel25;
    private javax.swing.JLabel jLabel26;
    private javax.swing.JLabel jLabel27;
    private javax.swing.JLabel jLabel28;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JLabel jLabel6;
    private javax.swing.JLabel jLabel7;
    private javax.swing.JLabel jLabel9;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JScrollPane jScrollPane2;
    private javax.swing.JTextField jTextField10;
    private javax.swing.JTextField jTextField11;
    private javax.swing.JTextField jTextField12;
    private javax.swing.JTextField jTextField2;
    private javax.swing.JTextField jTextField3;
    private javax.swing.JTextField jTextField4;
    private javax.swing.JTextField jTextField5;
    private javax.swing.JTextField jTextField6;
    private javax.swing.JTextField jTextField7;
    private javax.swing.JTextField jTextField8;
    private javax.swing.JTextField jTextField9;
    private javax.swing.JPanel panelcheques;
    private javax.swing.JPanel paneltarjeta;
    private javax.swing.JTable tablacuenta;
    private javax.swing.JTable tabladetalle;
    private javax.swing.JLabel txtcliente;
    private javax.swing.JTextField txtidcliente;
    // End of variables declaration//GEN-END:variables

    private void cargar_cliente() {
// DefaultTableModel tab = (DefaultTableModel) tabla.getModel();
//        tab.setRowCount(0);
////        DecimalFormat formato = new DecimalFormat("#,##0");
//        try {
//            // ilike busca las letras por mayusculas y minisculas
//            bd.listar_datos("SELECT id_cliente, cli_nombre, cli_ruc, cli_telef, cli_direc, id_estado\n"
//                    + "  FROM public.cliente where cli_ruc ::text ilike'%" + txtbuscar.getText() + "%' or cli_nombre ::text ilike'%" + txtbuscar.getText() + "%' ;");
//            while (bd.resultado.next()) {
//                tab.addRow(new Object[]{bd.resultado.getString("cli_nombre"),
//                    bd.resultado.getString("cli_ruc"),
//                    bd.resultado.getString("id_cliente")});
//
//            }
//
//        } catch (Exception e) {
//            JOptionPane.showMessageDialog(null, "Error al cargar la tabla" + e);
//            System.out.println("error en" + e);
//        }

//    }
//
//
  }
}
